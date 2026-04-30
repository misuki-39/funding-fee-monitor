export function dedupeByTime<T>(
  items: T[],
  getTime: (item: T) => number,
  startTimeMs: number,
  endTimeMs: number
): T[] {
  const filtered = items.filter((item) => {
    const time = getTime(item);
    return time >= startTimeMs && time <= endTimeMs;
  });
  return [...new Map(filtered.map((item) => [getTime(item), item] as const)).values()]
    .sort((left, right) => getTime(left) - getTime(right));
}
