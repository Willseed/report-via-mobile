import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

// Angular's former data group used these Cache Storage names for responses and metadata.
const LEGACY_LOCATION_CACHE = /^(?:db:)?\d+:data:nominatim-api:(?:cache|age|lru)$/;

@Injectable({ providedIn: 'root' })
export class LocationCacheCleanupService {
  private readonly platformId = inject(PLATFORM_ID);

  async clearLegacyLocationCaches(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      const cacheStorage = globalThis.caches;
      if (!cacheStorage) return;
      const scopePath = new URL('.', document.baseURI).pathname;
      const prefix = `ngsw:${scopePath}:`;
      const names = await cacheStorage.keys();
      const legacyNames = names.filter(
        (name) => name.startsWith(prefix) && LEGACY_LOCATION_CACHE.test(name.slice(prefix.length)),
      );
      await Promise.allSettled(legacyNames.map((name) => cacheStorage.delete(name)));
    } catch {
      // Cache Storage can be unavailable or blocked; cleanup must not prevent app startup.
    }
  }
}
