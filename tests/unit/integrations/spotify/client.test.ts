import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SpotifyClient } from '../../../../src/integrations/spotify/client.js';
import type { SpotifyTrack, ListeningHistory, SpotifyPlaylist } from '../../../../src/integrations/spotify/client.js';

describe('SpotifyClient', () => {
  let client: SpotifyClient;
  const mockToken = 'test-token-123';

  beforeEach(() => {
    client = new SpotifyClient(mockToken);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCurrentlyPlaying', () => {
    it('should return currently playing track', async () => {
      const mockResponse = {
        item: {
          id: 'track-1',
          name: 'Test Song',
          artists: [{ name: 'Test Artist' }, { name: 'Featured Artist' }],
          album: { name: 'Test Album' },
          duration_ms: 180000,
        },
        is_playing: true,
        progress_ms: 90000,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.getCurrentlyPlaying();

      expect(result).toEqual({
        id: 'track-1',
        name: 'Test Song',
        artist: 'Test Artist, Featured Artist',
        album: 'Test Album',
        durationMs: 180000,
        isPlaying: true,
        progressMs: 90000,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.spotify.com/v1/me/player/currently-playing',
        {
          headers: {
            'Authorization': `Bearer ${mockToken}`,
          },
        },
      );
    });

    it('should return null when nothing is playing (204)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 204,
      });

      const result = await client.getCurrentlyPlaying();
      expect(result).toBeNull();
    });

    it('should return null when nothing is playing (404)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 404,
      });

      const result = await client.getCurrentlyPlaying();
      expect(result).toBeNull();
    });

    it('should return null when item is missing', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ is_playing: false }),
      });

      const result = await client.getCurrentlyPlaying();
      expect(result).toBeNull();
    });

    it('should use cache on subsequent calls', async () => {
      const mockResponse = {
        item: {
          id: 'track-1',
          name: 'Test Song',
          artists: [{ name: 'Test Artist' }],
          album: { name: 'Test Album' },
          duration_ms: 180000,
        },
        is_playing: true,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      await client.getCurrentlyPlaying();
      await client.getCurrentlyPlaying();

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should throw on API error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(client.getCurrentlyPlaying()).rejects.toThrow(
        'Spotify API error: 401 Unauthorized',
      );
    });
  });

  describe('getRecentlyPlayed', () => {
    it('should return listening history', async () => {
      const mockResponse = {
        items: [
          {
            track: {
              id: 'track-1',
              name: 'Song 1',
              artists: [{ name: 'Artist 1' }],
              album: { name: 'Album 1' },
              duration_ms: 180000,
            },
            played_at: '2026-02-16T10:00:00Z',
          },
          {
            track: {
              id: 'track-2',
              name: 'Song 2',
              artists: [{ name: 'Artist 2' }],
              album: { name: 'Album 2' },
              duration_ms: 240000,
            },
            played_at: '2026-02-16T09:00:00Z',
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.getRecentlyPlayed(2);

      expect(result.tracks).toHaveLength(2);
      expect(result.totalMinutes).toBeCloseTo(7, 0);
      expect(result.tracks[0].track.name).toBe('Song 1');
      expect(result.tracks[0].playedAt).toBe('2026-02-16T10:00:00Z');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.spotify.com/v1/me/player/recently-played?limit=2',
        {
          headers: {
            'Authorization': `Bearer ${mockToken}`,
          },
        },
      );
    });

    it('should use default limit of 20', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [] }),
      });

      await client.getRecentlyPlayed();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.spotify.com/v1/me/player/recently-played?limit=20',
        expect.any(Object),
      );
    });

    it('should use cache on subsequent calls', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [] }),
      });

      await client.getRecentlyPlayed(5);
      await client.getRecentlyPlayed(5);

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should throw on API error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(client.getRecentlyPlayed()).rejects.toThrow(
        'Spotify API error: 500 Internal Server Error',
      );
    });
  });

  describe('getPlaylists', () => {
    it('should return user playlists', async () => {
      const mockResponse = {
        items: [
          {
            id: 'playlist-1',
            name: 'Focus Music',
            tracks: { total: 50 },
            description: 'Deep focus',
            uri: 'spotify:playlist:1',
          },
          {
            id: 'playlist-2',
            name: 'Workout',
            tracks: { total: 30 },
            uri: 'spotify:playlist:2',
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.getPlaylists(2);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'playlist-1',
        name: 'Focus Music',
        trackCount: 50,
        description: 'Deep focus',
        uri: 'spotify:playlist:1',
      });
      expect(result[1].description).toBeUndefined();
    });

    it('should throw on API error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      await expect(client.getPlaylists()).rejects.toThrow(
        'Spotify API error: 403 Forbidden',
      );
    });
  });

  describe('playPlaylist', () => {
    it('should start playing playlist without device ID', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 204,
      });

      const result = await client.playPlaylist('spotify:playlist:123');

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.spotify.com/v1/me/player/play',
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${mockToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            context_uri: 'spotify:playlist:123',
          }),
        },
      );
    });

    it('should start playing playlist with device ID', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 204,
      });

      const result = await client.playPlaylist('spotify:playlist:123', 'device-456');

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.spotify.com/v1/me/player/play',
        expect.objectContaining({
          body: JSON.stringify({
            context_uri: 'spotify:playlist:123',
            device_id: 'device-456',
          }),
        }),
      );
    });

    it('should throw on API error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(client.playPlaylist('spotify:playlist:123')).rejects.toThrow(
        'Spotify API error: 404 Not Found',
      );
    });
  });

  describe('pause', () => {
    it('should pause playback', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 204,
      });

      const result = await client.pause();

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.spotify.com/v1/me/player/pause',
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${mockToken}`,
          },
        },
      );
    });

    it('should throw on API error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      await expect(client.pause()).rejects.toThrow(
        'Spotify API error: 403 Forbidden',
      );
    });
  });

  describe('getListeningStats', () => {
    it('should calculate listening stats for time window', async () => {
      const now = Date.now();
      const recent = new Date(now - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
      const old = new Date(now - 48 * 60 * 60 * 1000).toISOString(); // 48 hours ago

      const mockResponse = {
        items: [
          {
            track: {
              id: 'track-1',
              name: 'Song 1',
              artists: [{ name: 'Artist A' }],
              album: { name: 'Album 1' },
              duration_ms: 180000,
            },
            played_at: recent,
          },
          {
            track: {
              id: 'track-2',
              name: 'Song 2',
              artists: [{ name: 'Artist A' }],
              album: { name: 'Album 2' },
              duration_ms: 240000,
            },
            played_at: recent,
          },
          {
            track: {
              id: 'track-3',
              name: 'Song 3',
              artists: [{ name: 'Artist B' }],
              album: { name: 'Album 3' },
              duration_ms: 200000,
            },
            played_at: old,
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.getListeningStats(24);

      expect(result.totalMinutes).toBeCloseTo(7, 0);
      expect(result.topArtists).toContain('Artist A');
      expect(result.topGenres).toEqual([]);
    });

    it('should handle empty results', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [] }),
      });

      const result = await client.getListeningStats();

      expect(result.totalMinutes).toBe(0);
      expect(result.topArtists).toEqual([]);
      expect(result.topGenres).toEqual([]);
    });
  });

  describe('formatForBriefing', () => {
    it('should format history for briefing', () => {
      const history: ListeningHistory = {
        tracks: [
          {
            track: {
              id: 'track-1',
              name: 'Song 1',
              artist: 'Artist 1',
              album: 'Album 1',
              durationMs: 180000,
              isPlaying: false,
            },
            playedAt: '2026-02-16T10:00:00Z',
          },
          {
            track: {
              id: 'track-2',
              name: 'Song 2',
              artist: 'Artist 2',
              album: 'Album 2',
              durationMs: 240000,
              isPlaying: false,
            },
            playedAt: '2026-02-16T09:00:00Z',
          },
        ],
        totalMinutes: 7,
      };

      const result = client.formatForBriefing(history);

      expect(result).toContain('7m total');
      expect(result).toContain('Song 1 by Artist 1');
      expect(result).toContain('Song 2 by Artist 2');
    });

    it('should format hours and minutes', () => {
      const history: ListeningHistory = {
        tracks: [
          {
            track: {
              id: 'track-1',
              name: 'Song 1',
              artist: 'Artist 1',
              album: 'Album 1',
              durationMs: 180000,
              isPlaying: false,
            },
            playedAt: '2026-02-16T10:00:00Z',
          },
        ],
        totalMinutes: 125,
      };

      const result = client.formatForBriefing(history);

      expect(result).toContain('2h 5m total');
    });

    it('should handle empty history', () => {
      const history: ListeningHistory = {
        tracks: [],
        totalMinutes: 0,
      };

      const result = client.formatForBriefing(history);

      expect(result).toBe('No recent listening activity.');
    });

    it('should limit to top 5 tracks', () => {
      const tracks = Array.from({ length: 10 }, (_, i) => ({
        track: {
          id: `track-${i}`,
          name: `Song ${i}`,
          artist: `Artist ${i}`,
          album: `Album ${i}`,
          durationMs: 180000,
          isPlaying: false,
        },
        playedAt: '2026-02-16T10:00:00Z',
      }));

      const history: ListeningHistory = {
        tracks,
        totalMinutes: 30,
      };

      const result = client.formatForBriefing(history);
      const trackLines = result.split('\n').filter((line) => line.startsWith('•'));

      expect(trackLines).toHaveLength(5);
    });
  });
});
