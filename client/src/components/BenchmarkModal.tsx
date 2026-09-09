import React, { useState } from "react";
import { X, Zap, Cpu, CheckCircle2, Play, Activity } from "lucide-react";
import { computeDHash, computeAHash, similarityFor } from "@shared/duplicate-similarity";

interface BenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BenchmarkModal({ isOpen, onClose }: BenchmarkModalProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{
    imagesProcessed: number;
    totalMs: number;
    filesPerSec: number;
    megapixelsPerSec: number;
    scoreGrade: string;
    hammingComparisons: number;
  } | null>(null);

  if (!isOpen) return null;

  const runBenchmark = async () => {
    setIsRunning(true);
    setProgress(5);
    setResults(null);

    await new Promise((r) => setTimeout(r, 100));

    const totalImages = 80;
    const signatures: number[][] = [];
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 120;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const startTime = performance.now();

    for (let i = 0; i < totalImages; i++) {
      if (ctx) {
        // Draw varied pattern
        ctx.fillStyle = `rgb(${(i * 35) % 255}, ${(i * 70) % 255}, ${(i * 110) % 255})`;
        ctx.fillRect(0, 0, 160, 120);
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc((i * 12) % 160, 60, 25, 0, Math.PI * 2);
        ctx.fill();

        // Downscale to 8x8
        const thumbCanvas = document.createElement("canvas");
        thumbCanvas.width = 8;
        thumbCanvas.height = 8;
        const tCtx = thumbCanvas.getContext("2d", { willReadFrequently: true });
        if (tCtx) {
          tCtx.drawImage(canvas, 0, 0, 8, 8);
          const p = tCtx.getImageData(0, 0, 8, 8).data;
          const sig: number[] = [];
          for (let j = 0; j < p.length; j += 4) {
            sig.push(Math.round(p[j] * 0.299 + p[j + 1] * 0.587 + p[j + 2] * 0.114));
          }
          signatures.push(sig);
        }
      }
      if (i % 10 === 0) {
        setProgress(Math.round(((i + 1) / totalImages) * 60));
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    setProgress(75);

    // Run all-to-all similarity matching
    let comparisonCount = 0;
    for (let i = 0; i < signatures.length; i++) {
      for (let j = i + 1; j < signatures.length; j++) {
        similarityFor(signatures[i], signatures[j]);
        comparisonCount++;
      }
    }

    const endTime = performance.now();
    const durationMs = Math.max(1, endTime - startTime);
    const filesPerSec = Math.round((totalImages / (durationMs / 1000)));
    const megapixelsPerSec = Number(((totalImages * (160 * 120)) / 1000000 / (durationMs / 1000)).toFixed(2));

    let grade = "A+ (Ultra-Fast)";
    if (filesPerSec < 50) grade = "B (Good)";
    else if (filesPerSec < 100) grade = "A (Very Fast)";

    setProgress(100);
    setResults({
      imagesProcessed: totalImages,
      totalMs: Math.round(durationMs),
      filesPerSec,
      megapixelsPerSec,
      scoreGrade: grade,
      hammingComparisons: comparisonCount,
    });
    setIsRunning(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-[540px] rounded-[28px] border border-[#e4e8ee] bg-white p-6 shadow-2xl sm:p-8 dark:border-[#2a374c] dark:bg-[#131923]">
        <div className="flex items-start justify-between border-b border-[#eef1f5] pb-4 dark:border-[#1e2736]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff0eb] text-[#f25b3d] dark:bg-[#38150f] dark:text-[#fa8269]">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#172033] dark:text-white">
                Client-Side Speed Benchmark
              </h2>
              <p className="mt-0.5 text-xs text-[#7c8799] dark:text-[#8a98b0]">
                Measures raw browser canvas decode & perceptual hashing throughput.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e2e7ef] text-[#55637a] transition hover:border-[#1957d2] hover:text-[#1957d2] dark:border-[#2a3447] dark:text-[#9fb0cf]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <p className="text-xs leading-5 text-[#55637a] dark:text-[#9fb0cf]">
            This test renders 80 procedural images in memory, applies grayscale 8×8 perceptual frequency hashing, and runs {`~3,160`} cross-comparisons.
          </p>

          {isRunning && (
            <div className="rounded-2xl border border-[#d7e2ff] bg-[#f0f5ff] p-4 dark:border-[#29427b] dark:bg-[#16274a]">
              <div className="mb-2 flex justify-between text-xs font-bold text-[#1957d2] dark:text-[#7ba6ff]">
                <span className="flex items-center gap-1.5">
                  <Activity className="h-4 w-4 animate-spin" /> Stress testing canvas pipeline…
                </span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#d7e2ff] dark:bg-[#20345e]">
                <div
                  className="h-full bg-[#1957d2] transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {results && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-[#bfe4ce] bg-[#eaf8f0] p-4 text-center dark:border-[#1e4d34] dark:bg-[#102e1f]">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#27764d] dark:text-[#58d492]">
                  Performance Rating
                </span>
                <p className="mt-1 text-2xl font-black text-[#27764d] dark:text-[#58d492]">
                  {results.scoreGrade}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-[#e2e7ef] bg-[#f8fafc] p-3 dark:border-[#2a374c] dark:bg-[#18202c]">
                  <p className="text-[10px] font-bold text-[#7c8799]">Throughput</p>
                  <p className="mt-1 text-lg font-black text-[#172033] dark:text-white">
                    {results.filesPerSec} <span className="text-xs font-semibold text-[#7c8799]">files/sec</span>
                  </p>
                </div>
                <div className="rounded-xl border border-[#e2e7ef] bg-[#f8fafc] p-3 dark:border-[#2a374c] dark:bg-[#18202c]">
                  <p className="text-[10px] font-bold text-[#7c8799]">Total Latency</p>
                  <p className="mt-1 text-lg font-black text-[#172033] dark:text-white">
                    {results.totalMs} <span className="text-xs font-semibold text-[#7c8799]">ms</span>
                  </p>
                </div>
                <div className="rounded-xl border border-[#e2e7ef] bg-[#f8fafc] p-3 dark:border-[#2a374c] dark:bg-[#18202c]">
                  <p className="text-[10px] font-bold text-[#7c8799]">Pixel Throughput</p>
                  <p className="mt-1 text-lg font-black text-[#172033] dark:text-white">
                    {results.megapixelsPerSec} <span className="text-xs font-semibold text-[#7c8799]">MP/s</span>
                  </p>
                </div>
                <div className="rounded-xl border border-[#e2e7ef] bg-[#f8fafc] p-3 dark:border-[#2a374c] dark:bg-[#18202c]">
                  <p className="text-[10px] font-bold text-[#7c8799]">Comparisons</p>
                  <p className="mt-1 text-lg font-black text-[#172033] dark:text-white">
                    {results.hammingComparisons} <span className="text-xs font-semibold text-[#7c8799]">pairs</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs font-bold text-[#7c8799] hover:underline dark:text-[#8a98b0]"
          >
            Close
          </button>
          <button
            onClick={runBenchmark}
            disabled={isRunning}
            className="inline-flex items-center gap-2 rounded-full bg-[#1957d2] px-6 py-2.5 text-xs font-bold text-white transition hover:bg-[#1146b5] disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" />
            {results ? "Run Again" : "Start Benchmark"}
          </button>
        </div>
      </div>
    </div>
  );
}
