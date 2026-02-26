import {Injectable, inject, PLATFORM_ID} from '@angular/core';
import {isPlatformBrowser} from '@angular/common';

const CACHE_NAME = 'map-images';
const KEY_PREFIX = 'http://map-cache.local/';

@Injectable({providedIn: 'root'})
export class MapImageCacheService {
  private platformId = inject(PLATFORM_ID);

  private get available(): boolean {
    return isPlatformBrowser(this.platformId) && typeof caches !== 'undefined';
  }

  private key(imageUrl: string): string {
    return KEY_PREFIX + imageUrl;
  }

  async get(imageUrl: string): Promise<Blob | null> {
    if (!this.available) return null;
    try {
      const cache = await caches.open(CACHE_NAME);
      const response = await cache.match(this.key(imageUrl));
      return response ? response.blob() : null;
    } catch {
      return null;
    }
  }

  async put(imageUrl: string, blob: Blob): Promise<void> {
    if (!this.available) return;
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(this.key(imageUrl), new Response(blob));
    } catch {
      console.log(`failed to put cache`);
    }
  }

  async evict(imageUrl: string): Promise<void> {
    if (!this.available) return;
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.delete(this.key(imageUrl));
    } catch {
      console.log(`failed to evict cache`);
    }
  }

  async sweep(validImageUrls: string[]): Promise<void> {
    if (!this.available) return;
    try {
      const cache = await caches.open(CACHE_NAME);
      const keys = await cache.keys();
      const validSet = new Set(validImageUrls.map(u => this.key(u)));
      for (const request of keys) {
        if (!validSet.has(request.url)) {
          await cache.delete(request);
        }
      }
    } catch {
      console.log(`failed to sweep cache`);
    }
  }
}
