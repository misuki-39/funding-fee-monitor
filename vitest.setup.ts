import "@testing-library/jest-dom/vitest";

class ResizeObserverStub {
  observe() {}

  unobserve() {}

  disconnect() {}
}

class LocalStorageStub {
  private store = new Map<string, string>();

  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

globalThis.ResizeObserver = ResizeObserverStub as typeof ResizeObserver;
Object.defineProperty(globalThis, "localStorage", {
  value: new LocalStorageStub(),
  configurable: true
});
