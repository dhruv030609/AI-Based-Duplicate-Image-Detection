import { describe, expect, it } from "vitest";
import {
  comparisonImageClass,
  differenceOverlayClass,
  similarityFor,
  computeAHash,
  computeDHash,
  hammingDistance,
  calculateBitDiffMatrix,
} from "../shared/duplicate-similarity";

describe("duplicate comparison utilities", () => {
  it("scores identical signatures as a high match", () => {
    const score = similarityFor([0, 40, 255], [0, 40, 255]);
    expect(score).toBeGreaterThanOrEqual(95);
  });

  it("scores different signatures lower while staying within the safe floor", () => {
    const score = similarityFor([0, 0, 0], [255, 255, 255]);
    expect(score).toBeGreaterThanOrEqual(50);
    expect(score).toBeLessThan(70);
  });

  it("keeps side-by-side mode visually neutral", () => {
    expect(comparisonImageClass("side-by-side")).toBe("");
    expect(differenceOverlayClass("side-by-side")).toBe("");
  });

  it("adds image treatment and an overlay in difference mode", () => {
    expect(comparisonImageClass("difference")).toContain("difference");
    expect(differenceOverlayClass("difference")).toContain("repeating-linear-gradient");
  });

  it("computes aHash correctly", () => {
    const hash = computeAHash([10, 20, 30, 40]);
    expect(hash).toEqual([0, 0, 1, 1]);
  });

  it("computes dHash correctly from 8x9 grid", () => {
    // Full 8x9 grid (72 pixels) => 64 bit hash
    const pixels = Array.from({ length: 72 }, (_, i) => (i * 17) % 256);
    const hash = computeDHash(pixels);
    expect(hash.length).toBe(64);
    expect(hash.every((b) => b === 0 || b === 1)).toBe(true);
  });

  it("calculates hamming distance between hashes", () => {
    expect(hammingDistance([0, 0, 1, 1], [0, 0, 1, 1])).toBe(0);
    expect(hammingDistance([0, 0, 1, 1], [1, 1, 0, 0])).toBe(4);
  });

  it("generates bit diff matrix", () => {
    const matrix = calculateBitDiffMatrix(
      [100, 100, 100, 100],
      [100, 100, 200, 200]
    );
    expect(matrix[0]).toBe(true);  // match
    expect(matrix[1]).toBe(true);  // match
    expect(matrix[2]).toBe(false); // diff of 100 > 20
    expect(matrix[3]).toBe(false); // diff of 100 > 20
  });
});
