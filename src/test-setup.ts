if (typeof globalThis.IntersectionObserver === 'undefined') {
  class IntersectionObserver {
    observe(): void {
      // no-op for tests
    }

    unobserve(): void {
      // no-op for tests
    }

    disconnect(): void {
      // no-op for tests
    }
  }

  globalThis.IntersectionObserver = IntersectionObserver as typeof globalThis.IntersectionObserver;
}

const needsLocalStorage =
  typeof globalThis.localStorage === 'undefined' ||
  typeof globalThis.localStorage.getItem !== 'function' ||
  typeof globalThis.localStorage.setItem !== 'function' ||
  typeof globalThis.localStorage.clear !== 'function';

if (needsLocalStorage) {
  const store = new Map<string, string>();
  const storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  } as Storage;

  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
  });
}

const needsSessionStorage =
  typeof globalThis.sessionStorage === 'undefined' ||
  typeof globalThis.sessionStorage.getItem !== 'function' ||
  typeof globalThis.sessionStorage.setItem !== 'function' ||
  typeof globalThis.sessionStorage.clear !== 'function';
if (needsSessionStorage) {
  const store = new Map<string, string>();
  const storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  } as Storage;

  Object.defineProperty(globalThis, 'sessionStorage', {
    value: storage,
    configurable: true,
  });
}
