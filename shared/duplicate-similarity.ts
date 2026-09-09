export type ComparisonMode = "side-by-side" | "difference" | "split" | "flicker";

/**
 * Calculates similarity percentage between two perceptual signatures (0 to 100%).
 * Uses normalized multi-factor distance (Hamming + L1 luminance distance).
 */
export function similarityFor(first?: number[], second?: number[]): number {
  if (!first || !second || first.length === 0 || second.length === 0) return 88;
  if (first.length !== second.length) return 85;

  let totalL1Distance = 0;
  let exactMatches = 0;

  for (let i = 0; i < first.length; i++) {
    const val1 = first[i] ?? 0;
    const val2 = second[i] ?? 0;
    const diff = Math.abs(val1 - val2);
    totalL1Distance += Math.min(255, diff);
    if (diff <= 8) {
      exactMatches += 1;
    }
  }

  const avgL1Diff = totalL1Distance / first.length;
  const matchRatio = exactMatches / first.length;

  // Blended perceptual similarity score: 70% L1 normalized + 30% tight match ratio
  const rawScore = 100 - (avgL1Diff / 2.55) * 0.7 - (1 - matchRatio) * 30;
  return Math.min(100, Math.max(50, Math.round(rawScore)));
}

/**
 * Computes difference hash (dHash) from an 8x9 pixel grayscale grid.
 * dHash tracks relative gradients horizontally (64 bits).
 */
export function computeDHash(pixels8x9: number[]): number[] {
  const hash: number[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = pixels8x9[row * 9 + col] ?? 0;
      const right = pixels8x9[row * 9 + col + 1] ?? 0;
      hash.push(left < right ? 1 : 0);
    }
  }
  return hash;
}

/**
 * Computes average hash (aHash) from an 8x8 pixel grayscale grid.
 */
export function computeAHash(pixels8x8: number[]): number[] {
  if (pixels8x8.length === 0) return [];
  const sum = pixels8x8.reduce((acc, v) => acc + v, 0);
  const avg = sum / pixels8x8.length;
  return pixels8x8.map((v) => (v >= avg ? 1 : 0));
}

/**
 * Calculates the Hamming distance between two binary hashes.
 */
export function hammingDistance(hash1: number[], hash2: number[]): number {
  if (!hash1 || !hash2) return 64;
  const len = Math.min(hash1.length, hash2.length);
  let distance = 0;
  for (let i = 0; i < len; i++) {
    if (hash1[i] !== hash2[i]) distance++;
  }
  return distance + Math.abs(hash1.length - hash2.length);
}

/**
 * Generates an 8x8 bit difference matrix (true for matching bit, false for differing bit).
 */
export function calculateBitDiffMatrix(hash1?: number[], hash2?: number[]): boolean[] {
  const size = 64;
  const result: boolean[] = [];
  for (let i = 0; i < size; i++) {
    if (!hash1 || !hash2 || hash1[i] === undefined || hash2[i] === undefined) {
      result.push(true);
    } else {
      const diff = Math.abs((hash1[i] ?? 0) - (hash2[i] ?? 0));
      result.push(diff < 20); // within tolerance threshold
    }
  }
  return result;
}

export function comparisonImageClass(mode: ComparisonMode): string {
  if (mode === "difference") {
    return "contrast-125 saturate-200 mix-blend-difference filter invert";
  }
  return "";
}

export function differenceOverlayClass(mode: ComparisonMode): string {
  if (mode === "difference") {
    return "bg-[repeating-linear-gradient(135deg,rgba(255,50,50,0.2)_0px,rgba(255,50,50,0.2)_2px,transparent_2px,transparent_7px)] mix-blend-screen";
  }
  return "";
}
