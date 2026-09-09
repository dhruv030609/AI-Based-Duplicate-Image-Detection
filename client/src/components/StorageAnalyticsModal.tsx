import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { X, BarChart3, HardDrive, Sparkles, FolderTree } from "lucide-react";
import type { Cluster, Asset } from "@/pages/Home";

interface StorageAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  clusters: Cluster[];
  keepMap: Record<string, string>;
  formatBytes: (bytes: number) => string;
}

const COLORS = ["#1957d2", "#f25b3d", "#36a76b", "#7828c8", "#f59e0b", "#06b6d4"];

export function StorageAnalyticsModal({
  isOpen,
  onClose,
  clusters,
  keepMap,
  formatBytes,
}: StorageAnalyticsModalProps) {
  if (!isOpen) return null;

  const totalFiles = clusters.reduce((acc, c) => acc + c.assets.length, 0);

  // Group duplicate savings by type
  const typeMap: Record<string, number> = {};
  const folderMap: Record<string, number> = {};
  let totalReclaimBytes = 0;
  let totalMegapixelsSaved = 0;

  clusters.forEach((cluster) => {
    const keeper =
      keepMap[cluster.id] ??
      cluster.assets.find((a) => a.recommendation === "keep")?.id ??
      cluster.assets[0]?.id;

    cluster.assets.forEach((asset) => {
      if (asset.id !== keeper) {
        totalReclaimBytes += asset.size;
        const mp = (asset.width * asset.height) / 1000000;
        totalMegapixelsSaved += mp;

        const type = asset.duplicateType || "Exact copy";
        typeMap[type] = (typeMap[type] || 0) + asset.size;

        const folder = asset.sourceFolder || "Camera";
        folderMap[folder] = (folderMap[folder] || 0) + asset.size;
      }
    });
  });

  const typeData = Object.entries(typeMap).map(([name, bytes]) => ({
    name,
    mb: Number((bytes / 1000000).toFixed(2)),
    formatted: formatBytes(bytes),
  }));

  const folderData = Object.entries(folderMap).map(([name, bytes]) => ({
    name,
    value: Number((bytes / 1000000).toFixed(2)),
    formatted: formatBytes(bytes),
  }));

  // Similarity Distribution
  const similarityBins = [
    { range: "100% (Exact)", count: 0 },
    { range: "90–99% (High)", count: 0 },
    { range: "80–89% (Medium)", count: 0 },
    { range: "<80% (Loose)", count: 0 },
  ];

  clusters.forEach((c) => {
    if (c.similarity === 100) similarityBins[0].count++;
    else if (c.similarity >= 90) similarityBins[1].count++;
    else if (c.similarity >= 80) similarityBins[2].count++;
    else similarityBins[3].count++;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-[920px] overflow-y-auto rounded-[28px] border border-[#e4e8ee] bg-white p-6 shadow-2xl sm:p-8 dark:border-[#2a374c] dark:bg-[#131923]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#eef1f5] pb-5 dark:border-[#1e2736]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef3ff] text-[#1957d2] dark:bg-[#16274a] dark:text-[#5b8dfc]">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-[#172033] dark:text-white">
                Storage & Visual Analytics
              </h2>
              <p className="mt-0.5 text-xs text-[#7c8799] dark:text-[#8a98b0]">
                Insights across {clusters.length} duplicate groups and {totalFiles} total photos.
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

        {/* Top Metric Cards */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#d7e2ff] bg-[#f0f5ff] p-4 dark:border-[#29427b] dark:bg-[#16274a]">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#1957d2] dark:text-[#7ba6ff]">
              Total Space Reclaimable
            </p>
            <p className="mt-2 text-2xl font-black text-[#172033] dark:text-white">
              {formatBytes(totalReclaimBytes)}
            </p>
            <p className="mt-1 text-[11px] text-[#55637a] dark:text-[#9fb0cf]">
              From {clusters.flatMap((c) => c.assets).length - clusters.length} duplicate files
            </p>
          </div>

          <div className="rounded-2xl border border-[#bfe4ce] bg-[#eaf8f0] p-4 dark:border-[#1e4d34] dark:bg-[#102e1f]">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#27764d] dark:text-[#58d492]">
              Resolution Waste Saved
            </p>
            <p className="mt-2 text-2xl font-black text-[#172033] dark:text-white">
              {totalMegapixelsSaved.toFixed(1)} MP
            </p>
            <p className="mt-1 text-[11px] text-[#55637a] dark:text-[#9fb0cf]">
              Redundant megapixels eliminated
            </p>
          </div>

          <div className="rounded-2xl border border-[#f7c4b7] bg-[#fff0eb] p-4 dark:border-[#5c281e] dark:bg-[#38150f]">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#c7472e] dark:text-[#fa8269]">
              Duplicate Groups
            </p>
            <p className="mt-2 text-2xl font-black text-[#172033] dark:text-white">
              {clusters.length}
            </p>
            <p className="mt-1 text-[11px] text-[#55637a] dark:text-[#9fb0cf]">
              {Object.keys(keepMap).length} reviewed ({Math.round(((Object.keys(keepMap).length) / Math.max(clusters.length, 1)) * 100)}%)
            </p>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* Reclaim by Duplicate Type */}
          <div className="rounded-2xl border border-[#e4e8ee] bg-[#f8fafc] p-5 dark:border-[#222c3c] dark:bg-[#18202c]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-[0.1em] text-[#172033] dark:text-white">
                Reclaim by Duplicate Category
              </h3>
              <Sparkles className="h-4 w-4 text-[#1957d2]" />
            </div>
            {typeData.length > 0 ? (
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={typeData}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={45} />
                    <YAxis tick={{ fontSize: 10 }} unit=" MB" />
                    <Tooltip
                      formatter={(val: number) => [`${val} MB`, "Space"]}
                      contentStyle={{ backgroundColor: "#1e293b", borderRadius: "10px", color: "white", fontSize: "12px" }}
                    />
                    <Bar dataKey="mb" fill="#1957d2" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-12 text-center text-xs text-[#7c8799]">No category data available</p>
            )}
          </div>

          {/* Source Folder Distribution */}
          <div className="rounded-2xl border border-[#e4e8ee] bg-[#f8fafc] p-5 dark:border-[#222c3c] dark:bg-[#18202c]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-[0.1em] text-[#172033] dark:text-white">
                Storage by Source Folder
              </h3>
              <FolderTree className="h-4 w-4 text-[#36a76b]" />
            </div>
            {folderData.length > 0 ? (
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={folderData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={4} label>
                      {folderData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number) => [`${val} MB`, "Folder Size"]}
                      contentStyle={{ backgroundColor: "#1e293b", borderRadius: "10px", color: "white", fontSize: "12px" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-12 text-center text-xs text-[#7c8799]">No folder data available</p>
            )}
          </div>
        </div>

        {/* Similarity Spectrum Distribution */}
        <div className="mt-6 rounded-2xl border border-[#e4e8ee] bg-[#f8fafc] p-5 dark:border-[#222c3c] dark:bg-[#18202c]">
          <h3 className="text-xs font-black uppercase tracking-[0.1em] text-[#172033] dark:text-white">
            Similarity Score Distribution (Hamming & Perceptual Spectrum)
          </h3>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {similarityBins.map((bin) => (
              <div key={bin.range} className="rounded-xl border border-[#e2e7ef] bg-white p-3 dark:border-[#2a374c] dark:bg-[#131923]">
                <p className="text-[10px] font-bold text-[#7c8799] dark:text-[#8a98b0]">{bin.range}</p>
                <p className="mt-1 text-xl font-black text-[#172033] dark:text-white">{bin.count} groups</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-full bg-[#1957d2] px-6 py-2.5 text-xs font-bold text-white transition hover:bg-[#1146b5]"
          >
            Close Analytics
          </button>
        </div>
      </div>
    </div>
  );
}
