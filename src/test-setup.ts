function getGlobalValue<K extends keyof typeof globalThis>(
  key: K,
): (typeof globalThis)[K] | undefined {
  return Reflect.get(globalThis, key) as (typeof globalThis)[K] | undefined;
}

if (getGlobalValue('IntersectionObserver') === undefined) {
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

  globalThis.IntersectionObserver =
    IntersectionObserver as unknown as typeof globalThis.IntersectionObserver;
}

function getStoredValue(store: Map<string, string>, key: string): string | null {
  const value = store.get(key);
  return value === undefined ? null : value;
}

function getKeyAtIndex(store: Map<string, string>, index: number): string | null {
  let currentIndex = 0;
  for (const key of store.keys()) {
    if (currentIndex === index) {
      return key;
    }

    currentIndex += 1;
  }

  return null;
}

const globalLocalStorage = getGlobalValue('localStorage');
const needsLocalStorage =
  globalLocalStorage === undefined ||
  typeof globalLocalStorage.getItem !== 'function' ||
  typeof globalLocalStorage.setItem !== 'function' ||
  typeof globalLocalStorage.clear !== 'function';

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
      return getStoredValue(store, key);
    },
    key(index: number) {
      return getKeyAtIndex(store, index);
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

const globalSessionStorage = getGlobalValue('sessionStorage');
const needsSessionStorage =
  globalSessionStorage === undefined ||
  typeof globalSessionStorage.getItem !== 'function' ||
  typeof globalSessionStorage.setItem !== 'function' ||
  typeof globalSessionStorage.clear !== 'function';
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
      return getStoredValue(store, key);
    },
    key(index: number) {
      return getKeyAtIndex(store, index);
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
