import { createLogger } from '../../kernel/logger.js';
import type { Logger } from 'pino';

const logger = createLogger('spotify-client');

export interface SpotifyTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  durationMs: number;
  isPlaying: boolean;
  progressMs?: number;
}

export interface ListeningHistory {
  tracks: Array<{
    track: SpotifyTrack;
    playedAt: string;
  }>;
  totalMinutes: number;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  trackCount: number;
  description?: string;
  uri: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class SpotifyClient {
  private readonly accessToken: string;
  private readonly baseUrl = 'https://api.spotify.com/v1';
  private readonly logger: Logger;
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  constructor(accessToken: string) {
    this.accessToken = accessToken;
    this.logger = logger.child({ integration: 'spotify' });
  }

  async getCurrentlyPlaying(): Promise<SpotifyTrack | null> {
    const cacheKey = 'currently-playing';
    const cached = this.getFromCache<SpotifyTrack | null>(cacheKey, 2 * 60 * 1000); // 2 minutes
    if (cached !== undefined) {
      return cached;
    }

    try {
      const response = await fetch(`${this.baseUrl}/me/player/currently-playing`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (response.status === 204 || response.status === 404) {
        this.setCache(cacheKey, null);
        return null;
      }

      if (!response.ok) {
        throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as {
        item?: {
          id: string;
          name: string;
          artists: Array<{ name: string }>;
          album: { name: string };
          duration_ms: number;
        };
        is_playing: boolean;
        progress_ms?: number;
      };

      if (!data.item) {
        this.setCache(cacheKey, null);
        return null;
      }

      const track: SpotifyTrack = {
        id: data.item.id,
        name: data.item.name,
        artist: data.item.artists.map((a) => a.name).join(', '),
        album: data.item.album.name,
        durationMs: data.item.duration_ms,
        isPlaying: data.is_playing,
        progressMs: data.progress_ms,
      };

      this.setCache(cacheKey, track);
      this.logger.info({ track: track.name }, 'Retrieved currently playing track');
      return track;
    } catch (error: unknown) {
      this.logger.error({ error }, 'Failed to get currently playing track');
      throw error;
    }
  }

  async getRecentlyPlayed(limit = 20): Promise<ListeningHistory> {
    const cacheKey = `recently-played-${limit}`;
    const cached = this.getFromCache<ListeningHistory>(cacheKey, 10 * 60 * 1000); // 10 minutes
    if (cached !== undefined) {
      return cached;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/me/player/recently-played?limit=${limit}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as {
        items: Array<{
          track: {
            id: string;
            name: string;
            artists: Array<{ name: string }>;
            album: { name: string };
            duration_ms: number;
          };
          played_at: string;
        }>;
      };

      const tracks = data.items.map((item) => ({
        track: {
          id: item.track.id,
          name: item.track.name,
          artist: item.track.artists.map((a) => a.name).join(', '),
          album: item.track.album.name,
          durationMs: item.track.duration_ms,
          isPlaying: false,
        },
        playedAt: item.played_at,
      }));

      const totalMinutes = tracks.reduce((sum, t) => sum + t.track.durationMs, 0) / 60000;

      const history: ListeningHistory = { tracks, totalMinutes };
      this.setCache(cacheKey, history);
      this.logger.info({ count: tracks.length, totalMinutes }, 'Retrieved listening history');
      return history;
    } catch (error: unknown) {
      this.logger.error({ error }, 'Failed to get recently played tracks');
      throw error;
    }
  }

  async getPlaylists(limit = 20): Promise<SpotifyPlaylist[]> {
    try {
      const response = await fetch(`${this.baseUrl}/me/playlists?limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as {
        items: Array<{
          id: string;
          name: string;
          tracks: { total: number };
          description?: string;
          uri: string;
        }>;
      };

      const playlists: SpotifyPlaylist[] = data.items.map((item) => ({
        id: item.id,
        name: item.name,
        trackCount: item.tracks.total,
        description: item.description,
        uri: item.uri,
      }));

      this.logger.info({ count: playlists.length }, 'Retrieved playlists');
      return playlists;
    } catch (error: unknown) {
      this.logger.error({ error }, 'Failed to get playlists');
      throw error;
    }
  }

  async playPlaylist(playlistUri: string, deviceId?: string): Promise<boolean> {
    try {
      const body: { context_uri: string; device_id?: string } = {
        context_uri: playlistUri,
      };

      if (deviceId) {
        body.device_id = deviceId;
      }

      const response = await fetch(`${this.baseUrl}/me/player/play`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.status === 204) {
        this.logger.info({ playlistUri, deviceId }, 'Started playing playlist');
        return true;
      }

      if (!response.ok) {
        throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
      }

      return true;
    } catch (error: unknown) {
      this.logger.error({ error, playlistUri }, 'Failed to play playlist');
      throw error;
    }
  }

  async pause(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/me/player/pause`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (response.status === 204) {
        this.logger.info('Paused playback');
        return true;
      }

      if (!response.ok) {
        throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
      }

      return true;
    } catch (error: unknown) {
      this.logger.error({ error }, 'Failed to pause playback');
      throw error;
    }
  }

  async getListeningStats(hours = 24): Promise<{
    totalMinutes: number;
    topArtists: string[];
    topGenres: string[];
  }> {
    try {
      // Get recent tracks (Spotify API limit is 50)
      const history = await this.getRecentlyPlayed(50);

      // Filter by time window
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
      const recentTracks = history.tracks.filter(
        (t) => new Date(t.playedAt) > cutoff,
      );

      const totalMinutes = recentTracks.reduce(
        (sum, t) => sum + t.track.durationMs,
        0,
      ) / 60000;

      // Count artists
      const artistCounts = new Map<string, number>();
      for (const { track } of recentTracks) {
        const count = artistCounts.get(track.artist) ?? 0;
        artistCounts.set(track.artist, count + 1);
      }

      const topArtists = Array.from(artistCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([artist]) => artist);

      // Note: Genres require additional API calls per artist
      // For now, return empty array to avoid excessive API calls
      const topGenres: string[] = [];

      this.logger.info(
        { totalMinutes, topArtists: topArtists.length },
        'Calculated listening stats',
      );

      return { totalMinutes, topArtists, topGenres };
    } catch (error: unknown) {
      this.logger.error({ error }, 'Failed to get listening stats');
      throw error;
    }
  }

  formatForBriefing(history: ListeningHistory): string {
    if (history.tracks.length === 0) {
      return 'No recent listening activity.';
    }

    const hours = Math.round(history.totalMinutes / 60);
    const minutes = Math.round(history.totalMinutes % 60);
    const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    const topTracks = history.tracks
      .slice(0, 5)
      .map((t) => `• ${t.track.name} by ${t.track.artist}`)
      .join('\n');

    return `Listening: ${timeStr} total\n\nTop tracks:\n${topTracks}`;
  }

  private getFromCache<T>(key: string, maxAge: number): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      return undefined;
    }

    const age = Date.now() - entry.timestamp;
    if (age > maxAge) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.data;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }
}
