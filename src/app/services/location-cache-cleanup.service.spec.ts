import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocationCacheCleanupService } from './location-cache-cleanup.service';

describe('LocationCacheCleanupService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('removes only the former Nominatim data group caches for this app scope', async () => {
    const names = [
      'ngsw:/:1:data:nominatim-api:cache',
      'ngsw:/:db:1:data:nominatim-api:age',
      'ngsw:/:db:1:data:nominatim-api:lru',
      'ngsw:/:db:control',
      'ngsw:/:1:assets:app:cache',
      'ngsw:/other/:1:data:nominatim-api:cache',
      'unrelated-cache',
    ];
    const deleteCache = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('caches', { keys: vi.fn().mockResolvedValue(names), delete: deleteCache });

    const service = TestBed.inject(LocationCacheCleanupService);
    await service.clearLegacyLocationCaches();

    expect(deleteCache.mock.calls.map(([name]) => name)).toEqual(names.slice(0, 3));
  });

  it('does not interrupt startup if Cache Storage rejects cleanup', async () => {
    vi.stubGlobal('caches', { keys: vi.fn().mockRejectedValue(new Error('unavailable')) });

    const service = TestBed.inject(LocationCacheCleanupService);
    await expect(service.clearLegacyLocationCaches()).resolves.toBeUndefined();
  });
});
