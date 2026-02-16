/**
 * WeatherAPI Integration
 *
 * Provides current weather, forecasts, and alerts via WeatherAPI.com
 * Free tier: 1M calls/month
 *
 * Usage:
 *   const weather = new WeatherClient(process.env.WEATHER_API_KEY);
 *   const current = await weather.getCurrent('Indianapolis');
 *   const forecast = await weather.getForecast('Indianapolis', 7);
 */

import { createLogger } from '../../kernel/logger.js';

const log = createLogger('weather-client');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WeatherData {
  location: string;
  tempF: number;
  tempC: number;
  condition: string;
  humidity: number;
  windMph: number;
  feelsLikeF: number;
  icon: string;
  isDay: boolean;
}

export interface ForecastDay {
  date: string;
  maxTempF: number;
  minTempF: number;
  condition: string;
  chanceOfRain: number;
  sunrise: string;
  sunset: string;
}

export interface WeatherAlert {
  headline: string;
  severity: string;
  event: string;
  effective: string;
  expires: string;
  description: string;
}

interface ApiCurrentResponse {
  location: {
    name: string;
    region: string;
  };
  current: {
    temp_f: number;
    temp_c: number;
    condition: {
      text: string;
      icon: string;
    };
    humidity: number;
    wind_mph: number;
    feelslike_f: number;
    is_day: number;
  };
}

interface ApiForecastResponse {
  location: {
    name: string;
    region: string;
  };
  forecast: {
    forecastday: Array<{
      date: string;
      day: {
        maxtemp_f: number;
        mintemp_f: number;
        condition: {
          text: string;
        };
        daily_chance_of_rain: number;
      };
      astro: {
        sunrise: string;
        sunset: string;
      };
    }>;
  };
  alerts?: {
    alert: Array<{
      headline: string;
      severity: string;
      event: string;
      effective: string;
      expires: string;
      desc: string;
    }>;
  };
}

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

// ─── Weather Client ─────────────────────────────────────────────────────────

export class WeatherClient {
  private apiKey: string;
  private baseUrl = 'https://api.weatherapi.com/v1';
  private cacheTtlMs = 30 * 60 * 1000; // 30 minutes
  private currentCache: Map<string, CacheEntry<WeatherData>> = new Map();
  private forecastCache: Map<string, CacheEntry<ForecastDay[]>> = new Map();
  private alertsCache: Map<string, CacheEntry<WeatherAlert[]>> = new Map();

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('WeatherAPI key is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Get current weather for a location
   */
  async getCurrent(location: string): Promise<WeatherData> {
    const cacheKey = location.toLowerCase();
    const cached = this.currentCache.get(cacheKey);

    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
      log.debug(`Using cached current weather for ${location}`);
      return cached.data;
    }

    try {
      const url = `${this.baseUrl}/current.json?key=${this.apiKey}&q=${encodeURIComponent(location)}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`WeatherAPI error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as ApiCurrentResponse;
      const weather: WeatherData = {
        location: `${data.location.name}, ${data.location.region}`,
        tempF: data.current.temp_f,
        tempC: data.current.temp_c,
        condition: data.current.condition.text,
        humidity: data.current.humidity,
        windMph: data.current.wind_mph,
        feelsLikeF: data.current.feelslike_f,
        icon: data.current.condition.icon,
        isDay: data.current.is_day === 1,
      };

      this.currentCache.set(cacheKey, { data: weather, fetchedAt: Date.now() });
      log.info(`Fetched current weather for ${location}: ${weather.tempF}°F, ${weather.condition}`);
      return weather;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Failed to fetch current weather for ${location}: ${message}`);
      throw new Error(`Failed to fetch weather: ${message}`);
    }
  }

  /**
   * Get forecast for a location
   */
  async getForecast(location: string, days: number = 3): Promise<ForecastDay[]> {
    if (days < 1 || days > 10) {
      throw new Error('Forecast days must be between 1 and 10');
    }

    const cacheKey = `${location.toLowerCase()}-${days}`;
    const cached = this.forecastCache.get(cacheKey);

    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
      log.debug(`Using cached forecast for ${location}`);
      return cached.data;
    }

    try {
      const url = `${this.baseUrl}/forecast.json?key=${this.apiKey}&q=${encodeURIComponent(location)}&days=${days}&alerts=yes`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`WeatherAPI error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as ApiForecastResponse;
      const forecast: ForecastDay[] = data.forecast.forecastday.map(day => ({
        date: day.date,
        maxTempF: day.day.maxtemp_f,
        minTempF: day.day.mintemp_f,
        condition: day.day.condition.text,
        chanceOfRain: day.day.daily_chance_of_rain,
        sunrise: day.astro.sunrise,
        sunset: day.astro.sunset,
      }));

      this.forecastCache.set(cacheKey, { data: forecast, fetchedAt: Date.now() });
      log.info(`Fetched ${days}-day forecast for ${location}`);
      return forecast;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Failed to fetch forecast for ${location}: ${message}`);
      throw new Error(`Failed to fetch forecast: ${message}`);
    }
  }

  /**
   * Get weather alerts for a location
   */
  async getAlerts(location: string): Promise<WeatherAlert[]> {
    const cacheKey = location.toLowerCase();
    const cached = this.alertsCache.get(cacheKey);

    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
      log.debug(`Using cached alerts for ${location}`);
      return cached.data;
    }

    try {
      const url = `${this.baseUrl}/forecast.json?key=${this.apiKey}&q=${encodeURIComponent(location)}&days=1&alerts=yes`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`WeatherAPI error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as ApiForecastResponse;
      const alerts: WeatherAlert[] = (data.alerts?.alert ?? []).map(alert => ({
        headline: alert.headline,
        severity: alert.severity,
        event: alert.event,
        effective: alert.effective,
        expires: alert.expires,
        description: alert.desc,
      }));

      this.alertsCache.set(cacheKey, { data: alerts, fetchedAt: Date.now() });
      log.info(`Fetched ${alerts.length} weather alerts for ${location}`);
      return alerts;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Failed to fetch alerts for ${location}: ${message}`);
      throw new Error(`Failed to fetch alerts: ${message}`);
    }
  }

  /**
   * Format weather data for briefing display
   */
  formatForBriefing(current: WeatherData, forecast: ForecastDay[]): string {
    const lines: string[] = [];

    // Current conditions
    lines.push(`📍 ${current.location}`);
    lines.push(`🌡️  ${current.tempF}°F (feels like ${current.feelsLikeF}°F)`);
    lines.push(`☁️  ${current.condition}`);
    lines.push(`💧 Humidity: ${current.humidity}% | 💨 Wind: ${current.windMph} mph`);

    if (forecast.length > 0) {
      lines.push('');
      lines.push('📅 Forecast:');
      for (const day of forecast.slice(0, 3)) {
        const date = new Date(day.date).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        });
        const rain = day.chanceOfRain > 0 ? ` | 🌧️  ${day.chanceOfRain}%` : '';
        lines.push(`  ${date}: ${day.minTempF}-${day.maxTempF}°F, ${day.condition}${rain}`);
      }
    }

    return lines.join('\n');
  }
}
