import React, { useState, useEffect, useRef } from "react";
import {
  X,
  ZoomIn,
  ZoomOut,
  Diff,
  Split,
  Eye,
  Sparkles,
  ArrowLeftRight,
  Check,
  Minus,
  CheckCheck,
  SlidersHorizontal,
  Flame,
  Binary,
  Layers,
  Info,
} from "lucide-react";
import {
  calculateBitDiffMatrix,
  comparisonImageClass,
  differenceOverlayClass,
  similarityFor,
  type ComparisonMode,
} from "@shared/duplicate-similarity";
import type { Cluster, Asset } from "@/pages/Home";

interface ClusterComparisonModalProps {
  cluster: Cluster | null;
  keepMap: Record<string, string>;
  onSelectKeeper: (clusterId: string, assetId: string) => void;
  onDismissCluster: (clusterId: string) => void;
  onClose: () => void;
  formatBytes: (bytes: number) => string;
}

export function ClusterComparisonModal({
  cluster,
  keepMap,
  onSelectKeeper,
  onDismissCluster,
  onClose,
  formatBytes,
}: ClusterComparisonModalProps) {
  const [compareMode, setCompareMode] = useState<ComparisonMode>("side-by-side");
  const [splitPosition, setSplitPosition] = useState(50);
  const [splitOrientation, setSplitOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showBitMatrix, setShowBitMatrix] = useState(false);
  const [flickerActiveIndex, setFlickerActiveIndex] = useState(0);
  const [isFlickerAuto, setIsFlickerAuto] = useState(false);

  // Auto flicker timer
  useEffect(() => {
    if (!isFlickerAuto || compareMode !== "flicker" || !cluster || cluster.assets.length < 2) return;
    const interval = setInterval(() => {
      setFlickerActiveIndex((prev) => (prev === 0 ? 1 : 0));
    }, 450);
    return () => clearInterval(interval);
  }, [isFlickerAuto, compareMode, cluster]);

  if (!cluster) return null;

  const currentKeeperId =
    keepMap[cluster.id] ??
    cluster.assets.find((a) => a.recommendation === "keep")?.id ??
    cluster.assets[0]?.id;

  const keeperAsset =
    cluster.assets.find((a) => a.id === currentKeeperId) ?? cluster.assets[0];
  const candidateAsset =
    cluster.assets.find((a) => a.id !== currentKeeperId) ?? cluster.assets[1] ?? cluster.assets[0];

  const bitDiffMatrix = calculateBitDiffMatrix(
    keeperAsset?.signature,
    candidateAsset?.signature
  );

  const matchingBits = bitDiffMatrix.filter(Boolean).length;
  const bitMatchPct = Math.round((matchingBits / 64) * 100);

  const handleKeeperClick = (assetId: string) => {
    onSelectKeeper(cluster.id, assetId);
  };

  const reclaimBytes = cluster.assets.reduce(
    (sum, a) => sum + (a.id === currentKeeperId ? 0 : a.size),
    0
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-md sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[94vh] w-full max-w-[1180px] overflow-auto rounded-t-[32px] border border-[#e4e8ee] bg-white shadow-2xl sm:rounded-[32px] dark:border-[#2a374c] dark:bg-[#131923]">
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[#e8ebf0] bg-white/95 px-6 py-4 backdrop-blur-xl sm:px-8 dark:border-[#1e2736] dark:bg-[#131923]/95">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#1957d2]" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#1957d2] dark:text-[#5b8dfc]">
                Inspection Studio & Comparison
              </span>
            </div>
            <h2 className="text-[22px] font-black tracking-[-0.03em] text-[#172033] dark:text-white">
              {cluster.label}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom controls */}
            <div className="flex items-center rounded-full border border-[#e2e7ef] bg-[#f8fafc] p-1 text-xs font-bold dark:border-[#2a3447] dark:bg-[#18202c]">
              <button
                onClick={() => setZoomLevel((z) => Math.max(1, Number((z - 0.25).toFixed(2))))}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white dark:hover:bg-[#202b3c]"
                title="Zoom Out"
              >
                <ZoomOut className="h-3.5 w-3.5 text-[#55637a] dark:text-[#9fb0cf]" />
              </button>
              <span className="px-2 text-[11px] text-[#172033] dark:text-white">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))))}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white dark:hover:bg-[#202b3c]"
                title="Zoom In"
              >
                <ZoomIn className="h-3.5 w-3.5 text-[#55637a] dark:text-[#9fb0cf]" />
              </button>
            </div>

            {/* Bit Matrix Toggle */}
            <button
              onClick={() => setShowBitMatrix(!showBitMatrix)}
              className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition ${showBitMatrix
                ? "border-[#1957d2] bg-[#eef3ff] text-[#1957d2] dark:border-[#5b8dfc] dark:bg-[#16274a] dark:text-[#5b8dfc]"
                : "border-[#e2e7ef] bg-white text-[#55637a] hover:border-[#1957d2] dark:border-[#2a3447] dark:bg-[#18202c] dark:text-[#9fb0cf]"
                }`}
              title="Inspect 8x8 Perceptual Hash Heatmap"
            >
              <Binary className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Hash Matrix</span>
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e2e7ef] text-[#55637a] transition hover:border-[#1957d2] hover:text-[#1957d2] dark:border-[#2a3447] dark:text-[#9fb0cf]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 sm:p-8">
          {/* Comparison Mode Switcher & Insight Bar */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#eef1f5] bg-[#f8fafc] p-3.5 dark:border-[#1e2736] dark:bg-[#18202c]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-[#6c788d] dark:text-[#8a98b0]">
                View Mode:
              </span>
              <div className="flex rounded-full border border-[#e2e7ef] bg-white p-1 text-[10px] font-bold dark:border-[#2a374c] dark:bg-[#131923]">
                <button
                  onClick={() => setCompareMode("side-by-side")}
                  className={`rounded-full px-3 py-1.5 transition ${compareMode === "side-by-side"
                    ? "bg-[#1957d2] text-white"
                    : "text-[#6c788d] hover:text-black dark:text-[#8a98b0] dark:hover:text-white"
                    }`}
                >
                  <Layers className="mr-1 inline h-3 w-3" /> Side by Side
                </button>
                <button
                  onClick={() => setCompareMode("difference")}
                  className={`rounded-full px-3 py-1.5 transition ${compareMode === "difference"
                    ? "bg-[#1957d2] text-white"
                    : "text-[#6c788d] hover:text-black dark:text-[#8a98b0] dark:hover:text-white"
                    }`}
                >
                  <Diff className="mr-1 inline h-3 w-3" /> Difference Heatmap
                </button>
                <button
                  onClick={() => setCompareMode("split")}
                  className={`rounded-full px-3 py-1.5 transition ${compareMode === "split"
                    ? "bg-[#1957d2] text-white"
                    : "text-[#6c788d] hover:text-black dark:text-[#8a98b0] dark:hover:text-white"
                    }`}
                >
                  <Split className="mr-1 inline h-3 w-3" /> Wipe Curtain
                </button>
                <button
                  onClick={() => setCompareMode("flicker")}
                  className={`rounded-full px-3 py-1.5 transition ${compareMode === "flicker"
                    ? "bg-[#1957d2] text-white"
                    : "text-[#6c788d] hover:text-black dark:text-[#8a98b0] dark:hover:text-white"
                    }`}
                >
                  <Flame className="mr-1 inline h-3 w-3" /> Flicker Loupe
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#eaf0ff] px-2.5 py-1 text-[10px] font-bold text-[#1957d2] dark:bg-[#16274a] dark:text-[#7ba6ff]">
                {cluster.similarity}% Visual Match
              </span>
              <span className="rounded-full bg-[#f0fdf4] px-2.5 py-1 text-[10px] font-bold text-[#166534] dark:bg-[#102e1f] dark:text-[#58d492]">
                {formatBytes(reclaimBytes)} reclaimable
              </span>
            </div>
          </div>

          {/* Wipe Curtain (Split Slider Mode) */}
          {compareMode === "split" && cluster.assets.length >= 2 && (
            <div className="mb-6 rounded-[24px] border border-[#e2e7ef] bg-[#0c1017] p-4 dark:border-[#2a374c]">
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[18px]">
                {/* Left image (Keeper) */}
                <img
                  src={keeperAsset.src}
                  alt={keeperAsset.name}
                  style={{ transform: `scale(${zoomLevel})` }}
                  className="absolute inset-0 h-full w-full object-contain"
                />
                {/* Right image with clip-path (Candidate) */}
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ clipPath: `inset(0 0 0 ${splitPosition}%)` }}
                >
                  <img
                    src={candidateAsset.src}
                    alt={candidateAsset.name}
                    style={{ transform: `scale(${zoomLevel})` }}
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                </div>
                {/* Split Divider Handle */}
                <div
                  className="absolute bottom-0 top-0 w-1 bg-white shadow-[0_0_12px_rgba(0,0,0,0.8)]"
                  style={{ left: `${splitPosition}%` }}
                >
                  <div className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#1957d2] shadow-lg">
                    <ArrowLeftRight className="h-4 w-4" />
                  </div>
                </div>
              </div>

              {/* Slider Controller */}
              <div className="mt-3 flex items-center justify-between gap-4 text-xs font-bold text-white">
                <span className="truncate text-green-400">
                  Keeper: {keeperAsset.name} ({keeperAsset.width}×{keeperAsset.height})
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={splitPosition}
                  onChange={(e) => setSplitPosition(Number(e.target.value))}
                  className="flex-1 accent-[#1957d2]"
                />
                <span className="truncate text-red-400">
                  Duplicate: {candidateAsset.name} ({candidateAsset.width}×{candidateAsset.height})
                </span>
              </div>
            </div>
          )}

          {/* Flicker Loupe Mode */}
          {compareMode === "flicker" && cluster.assets.length >= 2 && (
            <div className="mb-6 rounded-[24px] border border-[#e2e7ef] bg-[#0c1017] p-4 text-center dark:border-[#2a374c]">
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[18px]">
                <img
                  src={cluster.assets[flickerActiveIndex]?.src}
                  alt=""
                  style={{ transform: `scale(${zoomLevel})` }}
                  className="h-full w-full object-contain transition-none"
                />
                <div className="absolute bottom-3 left-3 rounded-xl bg-black/80 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md">
                  Viewing: {cluster.assets[flickerActiveIndex]?.name} (
                  {cluster.assets[flickerActiveIndex]?.id === currentKeeperId ? "Keeper ✓" : "Duplicate ✕"})
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => setIsFlickerAuto(!isFlickerAuto)}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${isFlickerAuto
                    ? "bg-amber-500 text-white"
                    : "bg-[#1957d2] text-white hover:bg-[#1146b5]"
                    }`}
                >
                  {isFlickerAuto ? "Pause Auto Flicker" : "Auto Flicker (450ms)"}
                </button>
                <button
                  onClick={() => setFlickerActiveIndex((prev) => (prev === 0 ? 1 : 0))}
                  className="rounded-full border border-gray-700 bg-gray-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-gray-800"
                >
                  Manual Toggle (Space)
                </button>
              </div>
            </div>
          )}

          {/* Perceptual 8x8 Bit Matrix Heatmap (Optional View) */}
          {showBitMatrix && (
            <div className="mb-6 rounded-2xl border border-[#d7e2ff] bg-[#f0f5ff] p-4 dark:border-[#29427b] dark:bg-[#16274a]">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-[0.1em] text-[#1957d2] dark:text-[#7ba6ff]">
                    8×8 Perceptual Frequency Bit Matrix
                  </h4>
                  <p className="mt-0.5 text-[11px] text-[#55637a] dark:text-[#9fb0cf]">
                    Compares discrete luminance gradients. Green cells indicate matching visual blocks ({bitMatchPct}% identical).
                  </p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#1957d2] shadow-sm dark:bg-[#131923] dark:text-[#7ba6ff]">
                  {matchingBits}/64 Blocks Match
                </span>
              </div>

              <div className="mt-4 flex items-center justify-center">
                <div className="grid grid-cols-8 gap-1 rounded-xl bg-white p-2 shadow-inner dark:bg-[#111722]">
                  {bitDiffMatrix.map((isMatch, idx) => (
                    <div
                      key={idx}
                      className={`h-4 w-4 rounded-[3px] transition-colors ${isMatch
                        ? "bg-[#36a76b]"
                        : "bg-[#f25b3d]"
                        }`}
                      title={`Block #${idx + 1}: ${isMatch ? "Match" : "Variance detected"}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Assets Grid Comparison Cards */}
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {cluster.assets.map((asset) => {
              const isKeeper = asset.id === currentKeeperId;

              return (
                <div
                  key={asset.id}
                  className={`overflow-hidden rounded-[24px] border-2 bg-white transition duration-200 dark:bg-[#18202c] ${isKeeper
                    ? "border-[#1957d2] shadow-[0_16px_36px_rgba(25,87,210,0.18)] dark:border-[#5b8dfc]"
                    : "border-[#e4e8ee] hover:border-[#b7c7ec] dark:border-[#2a374c]"
                    }`}
                >
                  {/* Image Viewer */}
                  <div className="relative aspect-[4/3] overflow-hidden bg-[#f1f3f6] dark:bg-[#101622]">
                    <img
                      src={asset.src}
                      alt={asset.name}
                      style={{ transform: `scale(${zoomLevel})` }}
                      className={`h-full w-full object-contain transition-transform duration-200 ${comparisonImageClass(
                        compareMode === "difference" ? "difference" : "side-by-side"
                      )}`}
                    />
                    {compareMode === "difference" && (
                      <div
                        className={`pointer-events-none absolute inset-0 ${differenceOverlayClass(
                          "difference"
                        )}`}
                      />
                    )}
                    <div className="absolute left-3 top-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] shadow-sm ${isKeeper
                          ? "bg-[#eaf8f0] text-[#27764d] dark:bg-[#102e1f] dark:text-[#58d492]"
                          : "bg-[#fff0eb] text-[#c7472e] dark:bg-[#38150f] dark:text-[#fa8269]"
                          }`}
                      >
                        {isKeeper ? (
                          <>
                            <Check className="h-3 w-3" /> Preserved Keeper
                          </>
                        ) : (
                          <>
                            <Minus className="h-3 w-3" /> Marked for Removal
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Metadata Matrix */}
                  <div className="p-4.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-[#172033] dark:text-white" title={asset.name}>
                          {asset.name}
                        </p>
                        <p className="mt-1 text-[11px] text-[#7c8799] dark:text-[#8a98b0]">
                          📁 {asset.sourceFolder || "Images"} · {asset.width} × {asset.height} (
                          {((asset.width * asset.height) / 1000000).toFixed(1)} MP)
                        </p>
                        <p className="mt-0.5 text-[11px] font-semibold text-[#1957d2] dark:text-[#7ba6ff]">
                          💾 File size: {formatBytes(asset.size)}
                        </p>
                      </div>

                      <button
                        onClick={() => handleKeeperClick(asset.id)}
                        className={`shrink-0 rounded-full px-3.5 py-1.5 text-[10px] font-extrabold transition ${isKeeper
                          ? "bg-[#1957d2] text-white shadow-sm"
                          : "border border-[#cfd6e2] text-[#55637a] hover:border-[#1957d2] hover:text-[#1957d2] dark:border-[#2a3447] dark:text-[#9fb0cf]"
                          }`}
                      >
                        {isKeeper ? "Keeper ✓" : "Keep This"}
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#f1f4f8] pt-3 dark:border-[#1e2736]">
                      <span className="rounded-md bg-[#f1f4f8] px-2 py-0.5 text-[9px] font-bold text-[#55637a] dark:bg-[#101622] dark:text-[#9fb0cf]">
                        {asset.duplicateType || (isKeeper ? "Original" : "Duplicate")}
                      </span>
                      <span className="rounded-md bg-[#eef3ff] px-2 py-0.5 text-[9px] font-bold text-[#1957d2] dark:bg-[#16274a] dark:text-[#7ba6ff]">
                        Quality Score: {asset.qualityScore ?? 85}/100
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sticky Bottom Actions Bar */}
          <div className="mt-6 flex flex-col justify-between gap-4 rounded-[22px] bg-[#172033] p-5 text-white sm:flex-row sm:items-center dark:bg-[#192230]">
            <div>
              <p className="text-sm font-bold">
                Preserving keeper leaves {formatBytes(reclaimBytes)} to reclaim in this group
              </p>
              <p className="mt-0.5 text-xs text-[#9fb0cf]">
                Choice is automatically locked. You can export cleanup scripts anytime.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => onDismissCluster(cluster.id)}
                className="rounded-full border border-gray-600 px-4 py-2.5 text-xs font-bold text-gray-300 transition hover:bg-gray-800"
              >
                Not Duplicates
              </button>
              <button
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-extrabold text-[#172033] transition hover:bg-[#eaf0ff]"
              >
                <CheckCheck className="h-4 w-4 text-[#36a76b]" /> Done Reviewing
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
