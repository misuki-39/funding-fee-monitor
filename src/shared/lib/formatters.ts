import type { CycleLabel } from "../types/market.js";

const cycleLabels = new Map<number, CycleLabel>([
  [1, "1h"],
  [2, "2h"],
  [4, "4h"],
  [8, "8h"]
]);

export function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(3)}%`;
}

export function parseCycleHours(cycleLabel: CycleLabel): number {
  const hours = Number(cycleLabel.slice(0, -1));

  if (!Number.isInteger(hours)) {
    throw new Error(`Unexpected cycle label: ${cycleLabel}`);
  }

  return hours;
}

export function formatAnnualizedRate(rate: number, cycleLabel: CycleLabel): string {
  const hours = parseCycleHours(cycleLabel);
  const annualizedRate = rate * (24 / hours) * 365;

  return formatRate(annualizedRate);
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 8
  }).format(price);
}

export function formatLastUpdated(timestamp: number | null): string {
  return timestamp === null ? "Last updated: never" : `Last updated: ${new Date(timestamp).toLocaleString()}`;
}

export function formatAbsoluteTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export function formatTimeToSettlement(settlementTimeMs: number, nowMs = Date.now()): string {
  const deltaMs = settlementTimeMs - nowMs;

  if (deltaMs <= 0) {
    return "settled";
  }

  const totalMinutes = Math.floor(deltaMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

export function formatCycle(hours: number): CycleLabel {
  const cycleLabel = cycleLabels.get(hours);

  if (!cycleLabel) {
    throw new Error(`Unexpected funding interval: ${hours}h`);
  }

  return cycleLabel;
}
