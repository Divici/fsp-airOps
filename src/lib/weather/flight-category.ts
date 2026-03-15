import type { FlightCategory } from "./types";

/**
 * Computes FAA flight category from ceiling and visibility.
 *
 * Rules (evaluated lowest category first):
 * - LIFR: ceiling < 500ft OR visibility < 1 SM
 * - IFR:  ceiling 500-999ft OR visibility 1-2.99 SM
 * - MVFR: ceiling 1000-3000ft OR visibility 3-5 SM
 * - VFR:  ceiling > 3000ft AND visibility > 5 SM
 *
 * A null ceiling means clear/unlimited and is treated as above any threshold.
 */
export function computeFlightCategory(
  ceiling: number | null,
  visibility: number
): FlightCategory {
  // Check LIFR first (most restrictive)
  if ((ceiling !== null && ceiling < 500) || visibility < 1) {
    return "LIFR";
  }

  // IFR
  if ((ceiling !== null && ceiling < 1000) || visibility < 3) {
    return "IFR";
  }

  // MVFR
  if ((ceiling !== null && ceiling <= 3000) || visibility <= 5) {
    return "MVFR";
  }

  // VFR
  return "VFR";
}
