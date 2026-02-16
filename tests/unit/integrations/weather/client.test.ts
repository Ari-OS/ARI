import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WeatherClient, type WeatherData, type ForecastDay, type WeatherAlert } from '../../../../src/integrations/weather/client.js';

// Mock logger
vi.mock('../../../../src/kernel/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ─── Test Data ──────────────────────────────────────────────────────────────

const MOCK_CURRENT_RESPONSE = {
  location: {
    name: 'Indianapolis',
    region: 'Indiana',
  },
  current: {
    temp_f: 72.5,
    temp_c: 22.5,
    condition: {
      text: 'Partly cloudy',
      icon: '//cdn.weatherapi.com/weather/64x64/day/116.png',
    },
    humidity: 65,
    wind_mph: 8.5,
    feelslike_f: 70.0,
    is_day: 1,
  },
};

const MOCK_FORECAST_RESPONSE = {
  location: {
    name: 'Indianapolis',
    region: 'Indiana',
  },
  forecast: {
    forecastday: [
      {
        date: '2026-02-17',
        day: {
          maxtemp_f: 75.0,
          mintemp_f: 55.0,
          condition: {
            text: 'Sunny',
          },
          daily_chance_of_rain: 10,
        },
        astro: {
          sunrise: '07:30 AM',
          sunset: '06:00 PM',
        },
      },
      {
        date: '2026-02-18',
        day: {
          maxtemp_f: 68.0,
          mintemp_f: 50.0,
          condition: {
            text: 'Rainy',
          },
          daily_chance_of_rain: 80,
        },
        astro: {
          sunrise: '07:29 AM',
          sunset: '06:01 PM',
        },
      },
    ],
  },
};

const MOCK_ALERTS_RESPONSE = {
  location: {
    name: 'Indianapolis',
    region: 'Indiana',
  },
  forecast: {
    forecastday: [
      {
        date: '2026-02-17',
        day: {
          maxtemp_f: 75.0,
          mintemp_f: 55.0,
          condition: { text: 'Sunny' },
          daily_chance_of_rain: 0,
        },
        astro: {
          sunrise: '07:30 AM',
          sunset: '06:00 PM',
        },
      },
    ],
  },
  alerts: {
    alert: [
      {
        headline: 'Severe Thunderstorm Warning',
        severity: 'Severe',
        event: 'Thunderstorm',
        effective: '2026-02-17T14:00:00-05:00',
        expires: '2026-02-17T18:00:00-05:00',
        desc: 'Severe thunderstorms expected in the area.',
      },
    ],
  },
};

// ─── Mock Fetch ─────────────────────────────────────────────────────────────

function mockFetch(response: unknown, status: number = 200): void {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => response,
  });
}

function mockFetchError(message: string): void {
  global.fetch = vi.fn().mockRejectedValue(new Error(message));
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('WeatherClient', () => {
  let client: WeatherClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new WeatherClient('test-api-key');
  });

  describe('constructor', () => {
    it('should throw if API key is missing', () => {
      expect(() => new WeatherClient('')).toThrow('WeatherAPI key is required');
    });

    it('should create client with valid API key', () => {
      expect(client).toBeInstanceOf(WeatherClient);
    });
  });

  describe('getCurrent', () => {
    it('should fetch and parse current weather', async () => {
      mockFetch(MOCK_CURRENT_RESPONSE);

      const weather = await client.getCurrent('Indianapolis');

      expect(weather.location).toBe('Indianapolis, Indiana');
      expect(weather.tempF).toBe(72.5);
      expect(weather.tempC).toBe(22.5);
      expect(weather.condition).toBe('Partly cloudy');
      expect(weather.humidity).toBe(65);
      expect(weather.windMph).toBe(8.5);
      expect(weather.feelsLikeF).toBe(70.0);
      expect(weather.isDay).toBe(true);
      expect(weather.icon).toContain('116.png');
    });

    it('should use cached data within TTL', async () => {
      mockFetch(MOCK_CURRENT_RESPONSE);

      await client.getCurrent('Indianapolis');
      await client.getCurrent('Indianapolis');

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should throw on API error', async () => {
      mockFetch({}, 401);

      await expect(client.getCurrent('Invalid')).rejects.toThrow('Failed to fetch weather');
    });

    it('should throw on network error', async () => {
      mockFetchError('Network failure');

      await expect(client.getCurrent('Indianapolis')).rejects.toThrow('Failed to fetch weather');
    });
  });

  describe('getForecast', () => {
    it('should fetch and parse forecast data', async () => {
      mockFetch(MOCK_FORECAST_RESPONSE);

      const forecast = await client.getForecast('Indianapolis', 2);

      expect(forecast).toHaveLength(2);
      expect(forecast[0].date).toBe('2026-02-17');
      expect(forecast[0].maxTempF).toBe(75.0);
      expect(forecast[0].minTempF).toBe(55.0);
      expect(forecast[0].condition).toBe('Sunny');
      expect(forecast[0].chanceOfRain).toBe(10);
      expect(forecast[0].sunrise).toBe('07:30 AM');
      expect(forecast[0].sunset).toBe('06:00 PM');
      expect(forecast[1].condition).toBe('Rainy');
      expect(forecast[1].chanceOfRain).toBe(80);
    });

    it('should default to 3 days if not specified', async () => {
      mockFetch(MOCK_FORECAST_RESPONSE);

      await client.getForecast('Indianapolis');

      const fetchMock = vi.mocked(global.fetch);
      expect(fetchMock).toHaveBeenCalled();
      const callUrl = fetchMock.mock.calls[0][0] as string;
      expect(callUrl).toContain('days=3');
    });

    it('should validate days range', async () => {
      await expect(client.getForecast('Indianapolis', 0)).rejects.toThrow('Forecast days must be between 1 and 10');
      await expect(client.getForecast('Indianapolis', 11)).rejects.toThrow('Forecast days must be between 1 and 10');
    });

    it('should use cached data within TTL', async () => {
      mockFetch(MOCK_FORECAST_RESPONSE);

      await client.getForecast('Indianapolis', 2);
      await client.getForecast('Indianapolis', 2);

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should throw on API error', async () => {
      mockFetch({}, 404);

      await expect(client.getForecast('Invalid')).rejects.toThrow('Failed to fetch forecast');
    });
  });

  describe('getAlerts', () => {
    it('should fetch and parse weather alerts', async () => {
      mockFetch(MOCK_ALERTS_RESPONSE);

      const alerts = await client.getAlerts('Indianapolis');

      expect(alerts).toHaveLength(1);
      expect(alerts[0].headline).toBe('Severe Thunderstorm Warning');
      expect(alerts[0].severity).toBe('Severe');
      expect(alerts[0].event).toBe('Thunderstorm');
      expect(alerts[0].effective).toBe('2026-02-17T14:00:00-05:00');
      expect(alerts[0].expires).toBe('2026-02-17T18:00:00-05:00');
      expect(alerts[0].description).toBe('Severe thunderstorms expected in the area.');
    });

    it('should return empty array if no alerts', async () => {
      mockFetch({
        ...MOCK_ALERTS_RESPONSE,
        alerts: undefined,
      });

      const alerts = await client.getAlerts('Indianapolis');

      expect(alerts).toEqual([]);
    });

    it('should use cached data within TTL', async () => {
      mockFetch(MOCK_ALERTS_RESPONSE);

      await client.getAlerts('Indianapolis');
      await client.getAlerts('Indianapolis');

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should throw on API error', async () => {
      mockFetch({}, 500);

      await expect(client.getAlerts('Indianapolis')).rejects.toThrow('Failed to fetch alerts');
    });
  });

  describe('formatForBriefing', () => {
    it('should format current weather and forecast', () => {
      const current: WeatherData = {
        location: 'Indianapolis, Indiana',
        tempF: 72.5,
        tempC: 22.5,
        condition: 'Partly cloudy',
        humidity: 65,
        windMph: 8.5,
        feelsLikeF: 70.0,
        icon: 'icon.png',
        isDay: true,
      };

      const forecast: ForecastDay[] = [
        {
          date: '2026-02-17',
          maxTempF: 75.0,
          minTempF: 55.0,
          condition: 'Sunny',
          chanceOfRain: 10,
          sunrise: '07:30 AM',
          sunset: '06:00 PM',
        },
        {
          date: '2026-02-18',
          maxTempF: 68.0,
          minTempF: 50.0,
          condition: 'Rainy',
          chanceOfRain: 80,
          sunrise: '07:29 AM',
          sunset: '06:01 PM',
        },
      ];

      const formatted = client.formatForBriefing(current, forecast);

      expect(formatted).toContain('Indianapolis, Indiana');
      expect(formatted).toContain('72.5°F');
      expect(formatted).toContain('feels like 70°F');
      expect(formatted).toContain('Partly cloudy');
      expect(formatted).toContain('Humidity: 65%');
      expect(formatted).toContain('Wind: 8.5 mph');
      expect(formatted).toContain('Forecast:');
      expect(formatted).toContain('Sunny');
      expect(formatted).toContain('Rainy');
      expect(formatted).toContain('80%');
    });

    it('should limit forecast to 3 days', () => {
      const current: WeatherData = {
        location: 'Indianapolis, Indiana',
        tempF: 70,
        tempC: 21,
        condition: 'Clear',
        humidity: 50,
        windMph: 5,
        feelsLikeF: 68,
        icon: 'icon.png',
        isDay: true,
      };

      const forecast: ForecastDay[] = Array.from({ length: 5 }, (_, i) => ({
        date: `2026-02-${17 + i}`,
        maxTempF: 75,
        minTempF: 55,
        condition: 'Sunny',
        chanceOfRain: 0,
        sunrise: '07:30 AM',
        sunset: '06:00 PM',
      }));

      const formatted = client.formatForBriefing(current, forecast);

      const forecastLines = formatted.split('\n').filter(line => line.includes('55-75°F'));
      expect(forecastLines.length).toBeLessThanOrEqual(3);
    });

    it('should handle empty forecast', () => {
      const current: WeatherData = {
        location: 'Indianapolis, Indiana',
        tempF: 70,
        tempC: 21,
        condition: 'Clear',
        humidity: 50,
        windMph: 5,
        feelsLikeF: 68,
        icon: 'icon.png',
        isDay: true,
      };

      const formatted = client.formatForBriefing(current, []);

      expect(formatted).toContain('Indianapolis, Indiana');
      expect(formatted).not.toContain('Forecast:');
    });

    it('should show rain chance only when present', () => {
      const current: WeatherData = {
        location: 'Indianapolis, Indiana',
        tempF: 70,
        tempC: 21,
        condition: 'Clear',
        humidity: 50,
        windMph: 5,
        feelsLikeF: 68,
        icon: 'icon.png',
        isDay: true,
      };

      const forecast: ForecastDay[] = [
        {
          date: '2026-02-17',
          maxTempF: 75,
          minTempF: 55,
          condition: 'Sunny',
          chanceOfRain: 0,
          sunrise: '07:30 AM',
          sunset: '06:00 PM',
        },
      ];

      const formatted = client.formatForBriefing(current, forecast);

      expect(formatted).not.toContain('🌧️');
    });
  });
});
