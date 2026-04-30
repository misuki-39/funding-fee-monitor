import { beforeEach, describe, expect, test, vi } from "vitest";
import { clearCache, getOrFetch, peekCache } from "./cache.js";

describe("cache", () => {
  beforeEach(() => {
    clearCache();
    vi.useRealTimers();
  });

  test("returns cached value within TTL without re-running fetcher", async () => {
    const fetcher = vi.fn().mockResolvedValue("first");

    const a = await getOrFetch("k", 1_000, fetcher);
    const b = await getOrFetch("k", 1_000, fetcher);

    expect(a).toBe("first");
    expect(b).toBe("first");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test("re-fetches after TTL expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T00:00:00Z"));

    const fetcher = vi.fn()
      .mockResolvedValueOnce("v1")
      .mockResolvedValueOnce("v2");

    const a = await getOrFetch("k", 1_000, fetcher);
    expect(a).toBe("v1");

    vi.setSystemTime(new Date("2026-04-30T00:00:02Z"));

    const b = await getOrFetch("k", 1_000, fetcher);
    expect(b).toBe("v2");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test("deduplicates concurrent fetches with the same key", async () => {
    let resolveFn: (value: string) => void = () => undefined;
    const fetcher = vi.fn(() => new Promise<string>((resolve) => {
      resolveFn = resolve;
    }));

    const first = getOrFetch("k", 1_000, fetcher);
    const second = getOrFetch("k", 1_000, fetcher);

    resolveFn("shared");

    expect(await first).toBe("shared");
    expect(await second).toBe("shared");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test("does not cache rejected fetches", async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new Error("upstream down"))
      .mockResolvedValueOnce("recovered");

    await expect(getOrFetch("k", 1_000, fetcher)).rejects.toThrow("upstream down");

    const value = await getOrFetch("k", 1_000, fetcher);
    expect(value).toBe("recovered");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test("peekCache returns valid entry without invoking fetcher and respects TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T00:00:00Z"));

    expect(peekCache<string>("k")).toBeUndefined();

    await getOrFetch("k", 1_000, () => Promise.resolve("v"));
    expect(peekCache<string>("k")).toBe("v");

    vi.setSystemTime(new Date("2026-04-30T00:00:02Z"));
    expect(peekCache<string>("k")).toBeUndefined();
  });
});
