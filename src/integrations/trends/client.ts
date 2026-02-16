import { createLogger } from '../../kernel/logger.js';
import type { Logger } from 'pino';

const logger = createLogger('google-trends');

export interface TrendingTopic {
  title: string;
  searchVolume: string;
  relatedQueries: string[];
  articles: Array<{ title: string; url: string; source: string }>;
  startedTrending: string;
  category: string;
}

export interface TrendData {
  keyword: string;
  timelineData: Array<{ date: string; value: number }>;
  relatedTopics: string[];
  relatedQueries: string[];
}

interface DailyTrendItem {
  title: { query: string };
  formattedTraffic: string;
  relatedQueries: Array<{ query: string }>;
  articles: Array<{ title: string; url: string; source: { title: string } }>;
  pubDate: string;
}

interface RealtimeTrendItem {
  title: string;
  entityNames: string[];
  articles: Array<{ articleTitle: string; url: string; source: string }>;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes
const RSS_PREFIX = `)]}',$\n`;

export class GoogleTrendsClient {
  private readonly cache: Map<string, CacheEntry<unknown>>;

  constructor() {
    this.cache = new Map();
    logger.info('GoogleTrendsClient initialized');
  }

  async getDailyTrending(geo: string = 'US'): Promise<TrendingTopic[]> {
    const cacheKey = `daily:${geo}`;
    const cached = this.getFromCache<TrendingTopic[]>(cacheKey);
    if (cached) {
      logger.debug({ geo }, 'Returning cached daily trends');
      return cached;
    }

    try {
      const url = `https://trends.google.com/trends/api/dailytrends?hl=en-US&tz=-300&geo=${geo}&ns=15`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      let text = await response.text();

      // Strip the safety prefix
      if (text.startsWith(RSS_PREFIX)) {
        text = text.slice(RSS_PREFIX.length);
      }

      const data = JSON.parse(text) as {
        default: { trendingSearchesDays: Array<{ trendingSearches: DailyTrendItem[] }> };
      };

      const trends: TrendingTopic[] = [];
      const trendingSearches = data.default.trendingSearchesDays[0]?.trendingSearches ?? [];

      for (const item of trendingSearches) {
        trends.push({
          title: item.title.query,
          searchVolume: item.formattedTraffic,
          relatedQueries: item.relatedQueries.map((q) => q.query),
          articles: item.articles.map((a) => ({
            title: a.title,
            url: a.url,
            source: a.source.title,
          })),
          startedTrending: item.pubDate,
          category: 'general',
        });
      }

      this.setCache(cacheKey, trends);
      logger.info({ geo, count: trends.length }, 'Fetched daily trends');
      return trends;
    } catch (error: unknown) {
      logger.error({ error, geo }, 'Failed to fetch daily trends');
      throw new Error(`Failed to fetch daily trends: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getRealtimeTrending(category: string = 'all', geo: string = 'US'): Promise<TrendingTopic[]> {
    const cacheKey = `realtime:${category}:${geo}`;
    const cached = this.getFromCache<TrendingTopic[]>(cacheKey);
    if (cached) {
      logger.debug({ category, geo }, 'Returning cached realtime trends');
      return cached;
    }

    try {
      const url = `https://trends.google.com/trends/api/realtimetrends?hl=en-US&tz=-300&geo=${geo}&category=${category}&fi=0&fs=0&ri=300&rs=20&sort=0`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      let text = await response.text();

      // Strip the safety prefix
      if (text.startsWith(RSS_PREFIX)) {
        text = text.slice(RSS_PREFIX.length);
      }

      const data = JSON.parse(text) as {
        storySummaries?: { trendingStories?: RealtimeTrendItem[] };
      };

      const trends: TrendingTopic[] = [];
      const trendingStories = data.storySummaries?.trendingStories ?? [];

      for (const item of trendingStories) {
        trends.push({
          title: item.title,
          searchVolume: 'N/A',
          relatedQueries: item.entityNames,
          articles: item.articles.map((a) => ({
            title: a.articleTitle,
            url: a.url,
            source: a.source,
          })),
          startedTrending: new Date().toISOString(),
          category: category === 'all' ? 'general' : category,
        });
      }

      this.setCache(cacheKey, trends);
      logger.info({ category, geo, count: trends.length }, 'Fetched realtime trends');
      return trends;
    } catch (error: unknown) {
      logger.error({ error, category, geo }, 'Failed to fetch realtime trends');
      throw new Error(`Failed to fetch realtime trends: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getInterestOverTime(keyword: string, days: number = 7): Promise<TrendData> {
    const cacheKey = `interest:${keyword}:${days}`;
    const cached = this.getFromCache<TrendData>(cacheKey);
    if (cached) {
      logger.debug({ keyword, days }, 'Returning cached interest data');
      return cached;
    }

    try {
      // Generate time range
      const now = new Date();
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const timeRange = `${this.formatDate(startDate)} ${this.formatDate(now)}`;

      // First get the token
      const tokenUrl = `https://trends.google.com/trends/api/explore?hl=en-US&tz=-300&req={"comparisonItem":[{"keyword":"${encodeURIComponent(keyword)}","geo":"","time":"${encodeURIComponent(timeRange)}"}],"category":0,"property":""}`;
      const tokenResponse = await fetch(tokenUrl);

      if (!tokenResponse.ok) {
        throw new Error(`HTTP ${tokenResponse.status}: ${tokenResponse.statusText}`);
      }

      let tokenText = await tokenResponse.text();
      if (tokenText.startsWith(RSS_PREFIX)) {
        tokenText = tokenText.slice(RSS_PREFIX.length);
      }

      const tokenData = JSON.parse(tokenText) as { widgets?: Array<{ token: string; id: string }> };
      const widget = tokenData.widgets?.find((w) => w.id === 'TIMESERIES');

      if (!widget?.token) {
        throw new Error('No timeline widget token found');
      }

      // Fetch timeline data
      const dataUrl = `https://trends.google.com/trends/api/widgetdata/multiline?hl=en-US&tz=-300&req={"time":"${encodeURIComponent(timeRange)}","resolution":"DAY","locale":"en-US","comparisonItem":[{"keyword":"${encodeURIComponent(keyword)}","geo":"","time":"${encodeURIComponent(timeRange)}"}],"requestOptions":{"property":"","backend":"IZG","category":0}}&token=${widget.token}`;
      const dataResponse = await fetch(dataUrl);

      if (!dataResponse.ok) {
        throw new Error(`HTTP ${dataResponse.status}: ${dataResponse.statusText}`);
      }

      let dataText = await dataResponse.text();
      if (dataText.startsWith(RSS_PREFIX)) {
        dataText = dataText.slice(RSS_PREFIX.length);
      }

      const timelineData = JSON.parse(dataText) as {
        default?: { timelineData?: Array<{ time: string; value: number[] }> };
      };

      const result: TrendData = {
        keyword,
        timelineData:
          timelineData.default?.timelineData?.map((point) => ({
            date: new Date(parseInt(point.time) * 1000).toISOString(),
            value: point.value[0] ?? 0,
          })) ?? [],
        relatedTopics: [],
        relatedQueries: [],
      };

      this.setCache(cacheKey, result);
      logger.info({ keyword, days, points: result.timelineData.length }, 'Fetched interest over time');
      return result;
    } catch (error: unknown) {
      logger.error({ error, keyword, days }, 'Failed to fetch interest over time');
      throw new Error(`Failed to fetch interest over time: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getRelatedTopics(keyword: string): Promise<string[]> {
    const cacheKey = `related:${keyword}`;
    const cached = this.getFromCache<string[]>(cacheKey);
    if (cached) {
      logger.debug({ keyword }, 'Returning cached related topics');
      return cached;
    }

    try {
      const url = `https://trends.google.com/trends/api/explore?hl=en-US&tz=-300&req={"comparisonItem":[{"keyword":"${encodeURIComponent(keyword)}","geo":"","time":"today 12-m"}],"category":0,"property":""}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      let text = await response.text();
      if (text.startsWith(RSS_PREFIX)) {
        text = text.slice(RSS_PREFIX.length);
      }

      const data = JSON.parse(text) as { widgets?: Array<{ token: string; id: string }> };
      const widget = data.widgets?.find((w) => w.id === 'RELATED_TOPICS');

      if (!widget?.token) {
        logger.warn({ keyword }, 'No related topics widget found');
        return [];
      }

      const dataUrl = `https://trends.google.com/trends/api/widgetdata/relatedsearches?hl=en-US&tz=-300&req={"restriction":{"geo":{},"time":"today 12-m","originalTimeRangeForExploreUrl":"today 12-m","complexKeywordsRestriction":{"keyword":[{"type":"BROAD","value":"${encodeURIComponent(keyword)}"}]}},"keywordType":"QUERY","metric":["TOP"],"trendinessSettings":{"compareTime":"2022-01-01 2023-01-01"},"requestOptions":{"property":"","backend":"IZG","category":0}}&token=${widget.token}`;
      const dataResponse = await fetch(dataUrl);

      if (!dataResponse.ok) {
        throw new Error(`HTTP ${dataResponse.status}: ${dataResponse.statusText}`);
      }

      let dataText = await dataResponse.text();
      if (dataText.startsWith(RSS_PREFIX)) {
        dataText = dataText.slice(RSS_PREFIX.length);
      }

      const topicsData = JSON.parse(dataText) as {
        default?: { rankedList?: Array<{ rankedKeyword?: Array<{ topic?: { title?: string } }> }> };
      };

      const topics: string[] = [];
      const rankedList = topicsData.default?.rankedList ?? [];

      for (const list of rankedList) {
        const keywords = list.rankedKeyword ?? [];
        for (const item of keywords) {
          if (item.topic?.title) {
            topics.push(item.topic.title);
          }
        }
      }

      this.setCache(cacheKey, topics);
      logger.info({ keyword, count: topics.length }, 'Fetched related topics');
      return topics;
    } catch (error: unknown) {
      logger.error({ error, keyword }, 'Failed to fetch related topics');
      return [];
    }
  }

  formatForBriefing(topics: TrendingTopic[], limit: number = 5): string {
    const topTopics = topics.slice(0, limit);
    const lines: string[] = ['Google Trends:', ''];

    for (let i = 0; i < topTopics.length; i++) {
      const topic = topTopics[i];
      lines.push(`${i + 1}. ${topic.title} (${topic.searchVolume})`);

      if (topic.relatedQueries.length > 0) {
        const related = topic.relatedQueries.slice(0, 3).join(', ');
        lines.push(`   Related: ${related}`);
      }

      if (topic.articles.length > 0) {
        const article = topic.articles[0];
        lines.push(`   ${article.source}: ${article.title}`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      return null;
    }

    const age = Date.now() - entry.timestamp;
    if (age > CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
