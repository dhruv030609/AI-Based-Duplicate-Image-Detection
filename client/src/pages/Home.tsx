import { ChangeEvent, DragEvent, useMemo, useRef, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { generateSampleClusters } from "@/lib/sampleImages";
import { similarityFor } from "@shared/duplicate-similarity";
import {
  generatePowershellScript,
  generateBatchScript,
  generateBashScript,
  generatePythonScript,
  generateHtmlAuditReport,
  exportKeeperZipArchive,
  exportDuplicatesZipArchive,
  downloadBlob,
  type ExportAsset,
  type ExportCluster,
} from "@/lib/exportUtils";
import { StorageAnalyticsModal } from "@/components/StorageAnalyticsModal";
import { BenchmarkModal } from "@/components/BenchmarkModal";
import { KeyboardShortcutsModal } from "@/components/KeyboardShortcutsModal";
import { ClusterComparisonModal } from "@/components/ClusterComparisonModal";
import {
  playClickSound,
  playKeeperSound,
  playSuccessFanfare,
  toggleMuteSound,
  getIsMuted,
} from "@/lib/soundEffects";

import JSZip from "jszip";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  CheckCheck,
  Diff,
  FileText,
  FolderTree,
  PackageOpen,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleHelp,
  Download,
  Eye,
  FileArchive,
  FolderOpen,
  Grid2x2Plus,
  HardDrive,
  Image as ImageIcon,
  Info,
  LockKeyhole,
  Minus,
  ScanSearch,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
  WandSparkles,
  X,
  Zap,
  Moon,
  Sun,
  Copy,
  History,
  Terminal,
  FileSpreadsheet,
  Search,
  Filter as FilterIcon,
  RefreshCw,
  ZoomIn,
  Split,
  ChevronDown,
  User as UserIcon,
  Mail,
  LogIn,
  LogOut,
  Crown,
  BarChart3,
  Keyboard,
  Volume2,
  VolumeX,
  Printer,
  Code2,
  CheckSquare,
} from "lucide-react";

export type Asset = {
  id: string;
  name: string;
  size: number;
  src: string;
  width: number;
  height: number;
  signature?: number[];
  recommendation?: "keep" | "remove" | "review";
  sourceFolder?: string;
  duplicateType?: string;
  qualityScore?: number;
};

export type Cluster = {
  id: string;
  label: string;
  note: string;
  similarity: number;
  assets: Asset[];
  accent: "coral" | "blue" | "ink";
};

type Filter = "all" | "review" | "reviewed" | "high-match" | "large-space";
type SortOption = "reclaim" | "similarity" | "count" | "name";

type SavedScan = {
  id: string;
  date: string;
  name: string;
  fileCount: number;
  duplicateGroupCount: number;
  reclaimableBytes: number;
  threshold: number;
  clusters: Cluster[];
  keepMap: Record<string, string>;
};

const formatBytes = (bytes: number): string => {
  if (bytes <= 0) return "0 B";
  if (bytes >= 1000000000) return `${(bytes / 1000000000).toFixed(2)} GB`;
  return `${(bytes / 1000000).toFixed(bytes >= 10000000 ? 0 : 2)} MB`;
};

const sourceFolderFor = (asset: Asset) =>
  asset.sourceFolder ??
  (/whatsapp|chat/i.test(asset.name)
    ? "WhatsApp"
    : /download|small|edit|crop|v2|webp/i.test(asset.name)
      ? "Downloads"
      : "Camera");

const duplicateTypeFor = (asset: Asset) =>
  asset.duplicateType ??
  (/whatsapp|chat|compressed/i.test(asset.name)
    ? "Compressed"
    : /crop/i.test(asset.name)
      ? "Cropped"
      : /edit|color|v2/i.test(asset.name)
        ? "Color changed"
        : /small|resize|webp/i.test(asset.name)
          ? "Resized"
          : "Exact copy");

const qualityScoreFor = (asset: Asset) =>
  asset.qualityScore ??
  Math.round(Math.min(100, (asset.width * asset.height) / 18000 + asset.size / 120000));

const buildUploadedClusters = (
  assets: Asset[],
  threshold: number,
  mode: "quick" | "careful"
): Cluster[] => {
  const remaining = new Set(assets.map((asset) => asset.id));
  const clusters: Cluster[] = [];
  const minimumSimilarity = Math.max(70, 100 - threshold * 2);
  let clusterIndex = 1;

  while (remaining.size) {
    const seed = assets.find((asset) => remaining.has(asset.id));
    if (!seed) break;
    const group = assets.filter(
      (asset) =>
        remaining.has(asset.id) &&
        similarityFor(seed.signature, asset.signature) >= minimumSimilarity
    );
    group.forEach((asset) => remaining.delete(asset.id));
    if (group.length < 2) continue;

    const sorted = [...group].sort((first, second) => {
      const firstCamera = sourceFolderFor(first).toLowerCase() === "camera" ? 1 : 0;
      const secondCamera = sourceFolderFor(second).toLowerCase() === "camera" ? 1 : 0;
      return (
        (mode === "quick" ? secondCamera - firstCamera : 0) ||
        qualityScoreFor(second) - qualityScoreFor(first)
      );
    });
    const keeper = sorted[0];
    const matchScores = group
      .slice(1)
      .map((asset) => similarityFor(seed.signature, asset.signature));

    clusters.push({
      id: `cluster-${Date.now()}-${clusterIndex}`,
      label: `Duplicate group ${String(clusterIndex).padStart(2, "0")}`,
      note: `${group.length} visually similar images · ${group
        .map((a) => sourceFolderFor(a))
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(", ")}`,
      similarity: Math.round(
        matchScores.reduce((sum, score) => sum + score, 0) /
        Math.max(matchScores.length, 1)
      ),
      accent: clusterIndex % 2 ? "blue" : "coral",
      assets: sorted.map((asset) => ({
        ...asset,
        duplicateType: duplicateTypeFor(asset),
        recommendation:
          asset.id === keeper.id ? "keep" : mode === "quick" ? "remove" : "review",
      })),
    });
    clusterIndex += 1;
  }
  return clusters;
};

const withTimeout = async <T,>(
  promise: Promise<T>,
  milliseconds: number,
  message: string
): Promise<T> => {
  let timeoutId: number | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), milliseconds);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
};

const hashFile = async (file: File): Promise<Asset> => {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.src = objectUrl;
  await withTimeout(
    new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(`Could not decode ${file.name}`));
    }),
    10000,
    `Timed out decoding ${file.name}`
  );

  let src = objectUrl;
  try {
    const maxDim = 480;
    const aspect = (image.naturalWidth || 1) / (image.naturalHeight || 1);
    const thumbW = aspect >= 1 ? maxDim : Math.max(1, Math.round(maxDim * aspect));
    const thumbH = aspect >= 1 ? Math.max(1, Math.round(maxDim / aspect)) : maxDim;
    const previewCanvas = document.createElement("canvas");
    previewCanvas.width = thumbW;
    previewCanvas.height = thumbH;
    const pCtx = previewCanvas.getContext("2d");
    if (pCtx) {
      pCtx.drawImage(image, 0, 0, thumbW, thumbH);
      src = previewCanvas.toDataURL("image/jpeg", 0.85);
    }
  } catch {
    src = objectUrl;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 8;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas unavailable");
  context.drawImage(image, 0, 0, 8, 8);
  const pixels = context.getImageData(0, 0, 8, 8).data;
  const signature: number[] = [];
  for (let index = 0; index < pixels.length; index += 4) {
    signature.push(
      Math.round(
        pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114
      )
    );
  }
  const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  return {
    id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
    name: file.name,
    size: file.size,
    src,
    width: image.naturalWidth || 1920,
    height: image.naturalHeight || 1080,
    signature,
    recommendation: "review",
    sourceFolder: relativePath
      ? relativePath.split("/").slice(-2, -1)[0] || "Camera"
      : "Camera",
    duplicateType: "Exact copy",
    qualityScore: Math.round(
      Math.min(
        100,
        (image.naturalWidth * image.naturalHeight) / 18000 + file.size / 120000
      )
    ),
  };
};

function LogoMark() {
  return (
    <div className="relative flex h-9 w-9 items-center justify-center rounded-[12px] border border-[#d7e2ff] bg-[#eef3ff] text-[#1957d2] shadow-sm dark:border-[#2d3a5a] dark:bg-[#152342] dark:text-[#5b8dfc]">
      <div className="absolute left-[8px] top-[8px] h-4 w-4 rounded-[4px] border-2 border-current" />
      <div className="absolute bottom-[7px] right-[7px] h-3 w-3 rounded-[3px] bg-current" />
    </div>
  );
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "blue" | "coral" | "green" | "purple";
}) {
  const tones = {
    neutral:
      "border-[#e2e7ef] bg-[#f4f6fa] text-[#55637a] dark:border-[#2a3447] dark:bg-[#1a2233] dark:text-[#9fb0cf]",
    blue: "border-[#bed0fb] bg-[#eaf0ff] text-[#1957d2] dark:border-[#29427b] dark:bg-[#132247] dark:text-[#7ba6ff]",
    coral: "border-[#f7c4b7] bg-[#fff0eb] text-[#c7472e] dark:border-[#5c281e] dark:bg-[#38150f] dark:text-[#fa8269]",
    green: "border-[#bfe4ce] bg-[#eaf8f0] text-[#27764d] dark:border-[#1e4d34] dark:bg-[#102e1f] dark:text-[#58d492]",
    purple:
      "border-[#dec7f7] bg-[#f7f0ff] text-[#7828c8] dark:border-[#4d1e70] dark:bg-[#28103c] dark:text-[#c582fa]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function HistoryPhotoThumb({ photo }: { photo: Asset }) {
  const [hasError, setHasError] = useState(false);
  const isBlob = typeof photo.src === "string" && photo.src.startsWith("blob:");

  if (hasError || isBlob || !photo.src) {
    return (
      <div
        className="group relative flex h-12 w-12 flex-shrink-0 flex-col items-center justify-center rounded-xl border border-[#d6dbe6] bg-[#eef3ff] p-1 text-center shadow-xs dark:border-[#2e3b4f] dark:bg-[#16274a]"
        title={`${photo.name} (${formatBytes(photo.size)}) · Session thumbnail expired`}
      >
        <ImageIcon className="h-4 w-4 text-[#1957d2] dark:text-[#7ba6ff]" />
        <span className="mt-0.5 max-w-full truncate text-[8px] font-bold text-[#55637a] dark:text-[#9fb0cf]">
          {photo.name.split(".").pop()?.toUpperCase() || "IMG"}
        </span>
      </div>
    );
  }

  return (
    <div
      className="group relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl border border-[#d6dbe6] bg-white shadow-xs dark:border-[#2e3b4f] dark:bg-[#111620]"
      title={`${photo.name} (${formatBytes(photo.size)})`}
    >
      <img
        src={photo.src}
        alt={photo.name}
        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-110"
        loading="lazy"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { user, isAuthenticated, login, register, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [rawAssets, setRawAssets] = useState<Asset[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("reclaim");
  const [threshold, setThreshold] = useState(10);
  const [mode, setMode] = useState<"quick" | "careful">("quick");
  const [smartRule, setSmartRule] = useState("camera");
  const [isDragging, setIsDragging] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scanMessage, setScanMessage] = useState("Ready to scan");

  // Modals state
  const [showInfo, setShowInfo] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showDemoMenu, setShowDemoMenu] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showBenchmark, setShowBenchmark] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "signup">("login");
  const [isMuted, setIsMuted] = useState(getIsMuted());

  const [authNameInput, setAuthNameInput] = useState("");
  const [authEmailInput, setAuthEmailInput] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [keepMap, setKeepMap] = useState<Record<string, string>>({});
  const [localHistory, setLocalHistory] = useState<SavedScan[]>([]);

  const historyQuery = trpc.scans.history.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const saveScanMutation = trpc.scans.save.useMutation({
    onSuccess: () => {
      historyQuery.refetch();
      toast.success("Scan saved to cloud account!");
    },
    onError: () => {
      saveScanLocally();
    },
  });
  const aiSummaryMutation = trpc.scans.aiSummary.useMutation();

  // Load scan history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("duplicate_finder_history");
      if (saved) {
        setLocalHistory(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  const handleCustomLogin = async (identifier: string, role: "user" | "admin" = "user") => {
    if (!identifier.trim()) {
      toast.error("Please enter your email or name");
      return;
    }
    setIsAuthenticating(true);
    try {
      await login({ emailOrName: identifier.trim(), role });
      setShowAuthModal(false);
      setShowUserMenu(false);
      setAuthNameInput("");
      setAuthEmailInput("");
      toast.success(`Logged in successfully!`);
    } catch (err: any) {
      console.error("[Login Error]", err);
      toast.error(err?.message || "Login failed. Please try again.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleCustomRegister = async (name: string, email: string) => {
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    setIsAuthenticating(true);
    try {
      await register({ name: name.trim(), email: email.trim(), role: "user" });
      setShowAuthModal(false);
      setShowUserMenu(false);
      setAuthNameInput("");
      setAuthEmailInput("");
      toast.success(`Account created & logged in! Welcome, ${name.trim()}!`);
    } catch (err: any) {
      console.error("[Register Error]", err);
      toast.error(err?.message || "Registration failed. Please try again.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const saveScanLocally = (customClusters?: Cluster[], customKeepMap?: Record<string, string>) => {
    const targetClusters = customClusters || clusters;
    const targetKeepMap = customKeepMap || keepMap;
    if (!targetClusters.length) return;

    const newScan: SavedScan = {
      id: `scan-${Date.now()}`,
      date: new Date().toLocaleString(),
      name: `Local Scan · ${new Date().toLocaleDateString()}`,
      fileCount: targetClusters.reduce((sum, c) => sum + c.assets.length, 0),
      duplicateGroupCount: targetClusters.length,
      reclaimableBytes: targetClusters.reduce((sum, c) => {
        const keeper =
          targetKeepMap[c.id] ??
          c.assets.find((a) => a.recommendation === "keep")?.id ??
          c.assets[0]?.id;
        return (
          sum +
          c.assets.reduce((csum, a) => csum + (a.id === keeper ? 0 : a.size), 0)
        );
      }, 0),
      threshold,
      clusters: targetClusters,
      keepMap: targetKeepMap,
    };

    setLocalHistory((prev) => {
      let updated = [newScan, ...prev.slice(0, 9)];
      try {
        localStorage.setItem("duplicate_finder_history", JSON.stringify(updated));
      } catch {
        try {
          updated = [newScan, ...prev.slice(0, 3)];
          localStorage.setItem("duplicate_finder_history", JSON.stringify(updated));
        } catch { }
      }
      return updated;
    });
  };

  const selectedCluster =
    clusters.find((cluster) => cluster.id === selectedClusterId) ?? null;

  const removalBytes = useMemo(() => {
    return clusters.reduce((total, cluster) => {
      const keeper =
        keepMap[cluster.id] ??
        cluster.assets.find((asset) => asset.recommendation === "keep")?.id ??
        cluster.assets[0]?.id;
      return (
        total +
        cluster.assets.reduce(
          (clusterTotal, asset) =>
            clusterTotal + (asset.id === keeper ? 0 : asset.size),
          0
        )
      );
    }, 0);
  }, [clusters, keepMap]);

  const reviewedCount = Object.keys(keepMap).length;

  // Filter & Search & Sort
  const displayedClusters = useMemo(() => {
    let result = clusters.filter((cluster) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesLabel = cluster.label.toLowerCase().includes(q);
        const matchesAsset = cluster.assets.some(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            sourceFolderFor(a).toLowerCase().includes(q) ||
            duplicateTypeFor(a).toLowerCase().includes(q)
        );
        if (!matchesLabel && !matchesAsset) return false;
      }

      if (filter === "all") return true;
      if (filter === "review") return !keepMap[cluster.id];
      if (filter === "reviewed") return Boolean(keepMap[cluster.id]);
      if (filter === "high-match") return cluster.similarity >= 90;
      if (filter === "large-space") {
        const clusterBytes = cluster.assets.reduce((sum, a) => sum + a.size, 0);
        return clusterBytes >= 2000000;
      }
      return true;
    });

    result.sort((a, b) => {
      if (sortOption === "similarity") return b.similarity - a.similarity;
      if (sortOption === "count") return b.assets.length - a.assets.length;
      if (sortOption === "name") return a.label.localeCompare(b.label);
      const aKeeper =
        keepMap[a.id] ??
        a.assets.find((x) => x.recommendation === "keep")?.id ??
        a.assets[0]?.id;
      const bKeeper =
        keepMap[b.id] ??
        b.assets.find((x) => x.recommendation === "keep")?.id ??
        b.assets[0]?.id;
      const aReclaim = a.assets.reduce(
        (sum, x) => sum + (x.id === aKeeper ? 0 : x.size),
        0
      );
      const bReclaim = b.assets.reduce(
        (sum, x) => sum + (x.id === bKeeper ? 0 : x.size),
        0
      );
      return bReclaim - aReclaim;
    });

    return result;
  }, [clusters, keepMap, filter, searchQuery, sortOption]);

  const openPicker = () => {
    playClickSound();
    inputRef.current?.click();
  };

  const handleLoadSamplePreset = async (preset: "all" | "vacation" | "urban" | "portrait" | "nature" = "all") => {
    setShowDemoMenu(false);
    playClickSound();
    setIsScanning(true);
    setProgress(15);
    setScanMessage("Generating demo photo dataset in memory…");
    try {
      const sample = await generateSampleClusters(preset);
      setProgress(70);
      setClusters(sample);
      const allSampleAssets = sample.flatMap((c) => c.assets);
      setRawAssets(allSampleAssets);
      setHasScanned(true);
      setSelectedClusterId(sample[0]?.id ?? null);
      setProgress(100);
      setScanMessage(
        `Loaded ${allSampleAssets.length} sample images across ${sample.length} duplicate groups`
      );
      toast.success("Sample duplicate dataset loaded!");
      saveScanLocally(sample, {});
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate sample dataset");
    } finally {
      setIsScanning(false);
    }
  };

  const handleThresholdChange = (newThreshold: number) => {
    setThreshold(newThreshold);
    if (rawAssets.length > 0) {
      const recomputed = buildUploadedClusters(rawAssets, newThreshold, mode);
      setClusters(recomputed);
      toast.info(`Updated similarity threshold to ${newThreshold} (${recomputed.length} groups)`);
    }
  };

  const expandZip = async (file: File): Promise<File[]> => {
    const zip = await withTimeout(
      JSZip.loadAsync(file),
      20000,
      "ZIP extraction timed out"
    );
    const entries = Object.values(zip.files).filter(
      (entry) =>
        !entry.dir && /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(entry.name)
    );
    const extracted: File[] = [];
    for (const entry of entries) {
      const blob = await withTimeout(
        entry.async("blob"),
        10000,
        `Timed out extracting ${entry.name}`
      );
      const extractedFile = new File(
        [blob],
        entry.name.split("/").pop() || "image.jpg",
        { type: blob.type || "image/jpeg" }
      );
      Object.defineProperty(extractedFile, "webkitRelativePath", {
        value: entry.name,
        configurable: true,
      });
      extracted.push(extractedFile);
    }
    return extracted;
  };

  const processFiles = async (incoming: File[]) => {
    if (!incoming.length) return;
    setHasScanned(true);
    setIsScanning(true);
    setProgress(8);
    setScanMessage("Reading image pixels locally…");
    const files: File[] = [];
    for (const file of incoming) {
      if (
        file.name.toLowerCase().endsWith(".zip") ||
        file.type === "application/zip" ||
        file.type === "application/x-zip-compressed"
      ) {
        try {
          files.push(...(await expandZip(file)));
        } catch {
          setScanMessage("Could not open this archive");
          toast.error(`Could not read archive ${file.name}`);
        }
      } else if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)) {
        files.push(file);
      }
    }
    setProgress(22);
    const assets: Asset[] = [];
    for (let index = 0; index < files.length; index += 1) {
      try {
        assets.push(await hashFile(files[index]));
      } catch {
        // Ignore files the browser cannot decode
      }
      setProgress(22 + Math.round(((index + 1) / Math.max(files.length, 1)) * 55));
    }

    if (assets.length) {
      setRawAssets((prev) => [...assets, ...prev]);
      const newClusters = buildUploadedClusters(
        [...assets, ...rawAssets],
        threshold,
        mode
      );
      setClusters(newClusters);
      setSelectedClusterId(newClusters[0]?.id ?? null);
      setScanMessage(
        newClusters.length
          ? `${assets.length} images scanned · ${newClusters.length} duplicate group${newClusters.length === 1 ? "" : "s"} found`
          : `${assets.length} images scanned · no duplicates found`
      );
      toast.success(
        `Scanned ${assets.length} images. Found ${newClusters.length} duplicate groups.`
      );

      saveScanLocally(newClusters, {});

      if (isAuthenticated) {
        aiSummaryMutation.mutate(
          {
            label: newClusters.length
              ? `${newClusters.length} uploaded duplicate groups`
              : "No duplicate groups",
            note: `${assets.length} images processed locally`,
            similarity: newClusters[0]?.similarity ?? 100,
            files: assets.map((asset) => ({
              name: asset.name,
              size: asset.size,
              width: asset.width,
              height: asset.height,
              folder: asset.sourceFolder,
            })),
          },
          { onSuccess: ({ summary }) => setScanMessage(summary) }
        );

        saveScanMutation.mutate({
          name: `Browser scan · ${new Date().toLocaleDateString()}`,
          fileCount: assets.length,
          duplicateGroupCount: newClusters.length,
          reclaimableBytes: newClusters.reduce(
            (sum, cluster) =>
              sum +
              cluster.assets
                .filter((asset) => asset.recommendation !== "keep")
                .reduce((bytes, asset) => bytes + asset.size, 0),
            0
          ),
          threshold,
          groups: newClusters.map((cluster) => ({
            label: cluster.label,
            note: cluster.note,
            similarity: cluster.similarity,
            accent: cluster.accent,
            assets: cluster.assets.map((asset) => ({
              fileName: asset.name,
              fileSize: asset.size,
              width: asset.width,
              height: asset.height,
              sourceFolder: asset.sourceFolder,
              duplicateType: asset.duplicateType,
              qualityScore: qualityScoreFor(asset),
              recommendation: asset.recommendation ?? "review",
              fingerprint: asset.signature,
              isKeeper: asset.recommendation === "keep",
            })),
          })),
        });
      }
    } else {
      setScanMessage("No supported images found");
      toast.error("No valid image files found");
    }
    setProgress(100);
    window.setTimeout(() => setIsScanning(false), 500);
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    void processFiles(Array.from(event.target.files ?? [])).catch(() => {
      setScanMessage("Scan stopped — please try another ZIP or image folder");
      setProgress(100);
      setIsScanning(false);
    });
    event.target.value = "";
  };

  const onFolderChange = (event: ChangeEvent<HTMLInputElement>) => {
    void processFiles(Array.from(event.target.files ?? [])).catch(() => {
      setScanMessage("Scan stopped — please try another folder");
      setProgress(100);
      setIsScanning(false);
    });
    event.target.value = "";
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void processFiles(Array.from(event.dataTransfer.files)).catch(() => {
      setScanMessage("Scan stopped — please try another ZIP or image folder");
      setProgress(100);
      setIsScanning(false);
    });
  };

  const setKeeper = (clusterId: string, assetId: string) => {
    playKeeperSound();
    setKeepMap((current) => {
      const next = { ...current, [clusterId]: assetId };
      if (clusters.length > 0 && Object.keys(next).length === clusters.length) {
        playSuccessFanfare();

        toast.success("🎉 All duplicate groups reviewed! Ready for cleanup export.");
      }
      return next;
    });
  };

  const applySmartRule = (rule: "quality" | "largest" | "camera") => {
    playClickSound();
    setSmartRule(rule);
    const next: Record<string, string> = {};
    clusters.forEach((cluster) => {
      const sorted = [...cluster.assets].sort((first, second) => {
        if (rule === "quality")
          return qualityScoreFor(second) - qualityScoreFor(first);
        if (rule === "largest") return second.size - first.size;
        const firstCamera =
          sourceFolderFor(first).toLowerCase() === "camera" ? 1 : 0;
        const secondCamera =
          sourceFolderFor(second).toLowerCase() === "camera" ? 1 : 0;
        return (
          secondCamera - firstCamera ||
          qualityScoreFor(second) - qualityScoreFor(first)
        );
      });
      if (sorted[0]) next[cluster.id] = sorted[0].id;
    });
    setKeepMap(next);

    toast.success(
      `Smart rule applied: ${rule === "camera"
        ? "Prefer Camera"
        : rule === "quality"
          ? "Highest Quality"
          : "Largest File"
      }`
    );
  };

  const dismissCluster = (clusterId: string) => {
    setClusters((prev) => prev.filter((c) => c.id !== clusterId));
    if (selectedClusterId === clusterId) setSelectedClusterId(null);
    toast.info("Group dismissed");
  };

  const unwantedAssets = (): ExportAsset[] =>
    clusters.flatMap((cluster) => {
      const keeper =
        keepMap[cluster.id] ??
        cluster.assets.find((asset) => asset.recommendation === "keep")?.id ??
        cluster.assets[0]?.id;
      return cluster.assets
        .filter((asset) => asset.id !== keeper)
        .map((asset) => ({ ...asset, sourceFolder: sourceFolderFor(asset) }));
    });

  const keeperAssets = (): ExportAsset[] =>
    clusters.flatMap((cluster) => {
      const keeper =
        keepMap[cluster.id] ??
        cluster.assets.find((asset) => asset.recommendation === "keep")?.id ??
        cluster.assets[0]?.id;
      return cluster.assets
        .filter((asset) => asset.id === keeper)
        .map((asset) => ({ ...asset, sourceFolder: sourceFolderFor(asset) }));
    });

  // Export handlers
  const handleExportTxt = () => {
    const files = unwantedAssets();
    if (!files.length) {
      toast.error("No duplicate files marked for removal");
      return;
    }
    const body = [
      "==================================================",
      " Duplicate Image Finder — Removal Manifest",
      ` Generated: ${new Date().toLocaleString()}`,
      ` Total duplicate files: ${files.length}`,
      ` Reclaimable storage: ${formatBytes(
        files.reduce((sum, asset) => sum + asset.size, 0)
      )}`,
      "==================================================",
      "",
      ...files.map(
        (asset) =>
          `[REMOVE]  ${asset.sourceFolder}/${asset.name.padEnd(35)}  ${formatBytes(
            asset.size
          ).padEnd(10)}  ${duplicateTypeFor(asset)}`
      ),
      "",
      "--- KEEPERS PRESERVED ---",
      ...keeperAssets().map(
        (asset) =>
          `[KEEP]    ${asset.sourceFolder}/${asset.name.padEnd(35)}  ${formatBytes(
            asset.size
          ).padEnd(10)}  (Quality score: ${qualityScoreFor(asset)}/100)`
      ),
    ].join("\n");
    downloadBlob(new Blob([body], { type: "text/plain" }), "duplicate-removal-manifest.txt");
  };

  const handleExportCsv = () => {
    const files = unwantedAssets();
    if (!files.length) {
      toast.error("No duplicate files marked for removal");
      return;
    }
    const header = "Action,Folder,FileName,SizeBytes,FormattedSize,Type,QualityScore\n";
    const rows = files
      .map(
        (a) =>
          `REMOVE,"${a.sourceFolder}","${a.name}",${a.size},"${formatBytes(
            a.size
          )}","${duplicateTypeFor(a)}",${qualityScoreFor(a)}`
      )
      .join("\n");
    downloadBlob(
      new Blob([header + rows], { type: "text/csv;charset=utf-8;" }),
      "duplicate-removal.csv"
    );
  };

  const handleExportPowershell = () => {
    const files = unwantedAssets();
    if (!files.length) {
      toast.error("No duplicates to remove");
      return;
    }
    const script = generatePowershellScript(files, keeperAssets(), formatBytes);
    downloadBlob(new Blob([script], { type: "text/plain" }), "delete-duplicates.ps1");
  };

  const handleExportBatch = () => {
    const files = unwantedAssets();
    if (!files.length) {
      toast.error("No duplicates to remove");
      return;
    }
    const script = generateBatchScript(files, formatBytes);
    downloadBlob(new Blob([script], { type: "text/plain" }), "delete-duplicates.bat");
  };

  const handleExportBash = () => {
    const files = unwantedAssets();
    if (!files.length) {
      toast.error("No duplicates to remove");
      return;
    }
    const script = generateBashScript(files, formatBytes);
    downloadBlob(new Blob([script], { type: "text/x-shellscript" }), "delete-duplicates.sh");
  };

  const handleExportPython = () => {
    const files = unwantedAssets();
    if (!files.length) {
      toast.error("No duplicates to remove");
      return;
    }
    const script = generatePythonScript(files, keeperAssets(), formatBytes);
    downloadBlob(new Blob([script], { type: "text/x-python" }), "delete-duplicates.py");
  };

  const handleExportHtmlReport = () => {
    if (!clusters.length) {
      toast.error("No clusters to generate report for");
      return;
    }
    const html = generateHtmlAuditReport(clusters, keepMap, formatBytes);
    const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    toast.success("Opened Visual Audit Report in new tab!");
  };

  const copyFilePathsToClipboard = async () => {
    const files = unwantedAssets();
    if (!files.length) {
      toast.error("No duplicate files marked for removal");
      return;
    }
    const text = files.map((a) => `${a.sourceFolder}/${a.name}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copied ${files.length} file paths to clipboard!`);
    } catch {
      toast.error("Unable to copy to clipboard");
    }
  };

  const loadSavedScan = (saved: SavedScan) => {
    setClusters(saved.clusters);
    setRawAssets(saved.clusters.flatMap((c) => c.assets));
    setKeepMap(saved.keepMap || {});
    setThreshold(saved.threshold);
    setSelectedClusterId(saved.clusters[0]?.id ?? null);
    setHasScanned(true);
    setShowHistory(false);
    toast.success(`Loaded scan from ${saved.date}`);
  };

  const resetAll = () => {
    setClusters([]);
    setRawAssets([]);
    setKeepMap({});
    setSelectedClusterId(null);
    setHasScanned(false);
    toast.info("Workspace reset");
  };

  // Keyboard navigation listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "?") {
        setShowShortcuts((prev) => !prev);
      } else if (e.key === "Escape") {
        setSelectedClusterId(null);
        setShowShortcuts(false);
        setShowAnalytics(false);
        setShowBenchmark(false);
        setShowExportMenu(false);
        setShowDemoMenu(false);
      } else if (e.key === "ArrowRight" || e.key === "]") {
        if (!clusters.length) return;
        const curIdx = clusters.findIndex((c) => c.id === selectedClusterId);
        const nextIdx = (curIdx + 1) % clusters.length;
        setSelectedClusterId(clusters[nextIdx].id);
      } else if (e.key === "ArrowLeft" || e.key === "[") {
        if (!clusters.length) return;
        const curIdx = clusters.findIndex((c) => c.id === selectedClusterId);
        const prevIdx = (curIdx - 1 + clusters.length) % clusters.length;
        setSelectedClusterId(clusters[prevIdx].id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clusters, selectedClusterId]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fafbfc] text-[#172033] transition-colors duration-200 dark:bg-[#0c1017] dark:text-[#e4e9f2]">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-[#e8ebf0] bg-white/95 backdrop-blur-xl dark:border-[#1e2736] dark:bg-[#0f141d]/95">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-3.5 lg:px-10">
          <div className="flex items-center gap-3.5">
            <LogoMark />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[16px] font-extrabold tracking-[-0.05em]">
                  duplicate
                </span>
                <span className="text-[16px] font-extrabold tracking-[-0.05em] text-[#1957d2] dark:text-[#5b8dfc]">
                  /finder
                </span>
              </div>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.22em] text-[#988f84] dark:text-[#6a7485]">
                private photo cleanup
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-[#7c8799] sm:flex dark:text-[#8a98b0]">
            <span className="h-2 w-2 rounded-full bg-[#36a76b]" /> 100% Client-Side{" "}
            <span className="text-[#c4cad4] dark:text-[#374457]">·</span> Zero Server Uploads
          </div>

          <div className="flex items-center gap-2">
            {/* Try Demo Preset Dropdown */}
            <div className="relative">
              {showDemoMenu && (
                <div className="absolute right-0 top-full z-40 mt-1.5 w-64 rounded-2xl border border-[#e2e7ef] bg-white p-2 shadow-xl dark:border-[#2a374c] dark:bg-[#151c27]">
                  <p className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8b97ab]">
                    Demo Photo Scenarios
                  </p>
                  <button
                    onClick={() => handleLoadSamplePreset("all")}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold text-[#172033] hover:bg-[#f1f4fa] dark:text-white dark:hover:bg-[#1d2738]"
                  >
                    <span>🌟 All Scenarios (Master Catalog)</span>
                  </button>
                  <button
                    onClick={() => handleLoadSamplePreset("vacation")}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold text-[#172033] hover:bg-[#f1f4fa] dark:text-white dark:hover:bg-[#1d2738]"
                  >
                    <span>🏔️ Mountain Sunset (4K vs WhatsApp)</span>
                  </button>
                  <button
                    onClick={() => handleLoadSamplePreset("urban")}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold text-[#172033] hover:bg-[#f1f4fa] dark:text-white dark:hover:bg-[#1d2738]"
                  >
                    <span>🏙️ Urban Skyline (Color Grade & WebP)</span>
                  </button>
                  <button
                    onClick={() => handleLoadSamplePreset("portrait")}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold text-[#172033] hover:bg-[#f1f4fa] dark:text-white dark:hover:bg-[#1d2738]"
                  >
                    <span>👤 Studio Portrait (Lossless vs Clones)</span>
                  </button>
                  <button
                    onClick={() => handleLoadSamplePreset("nature")}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold text-[#172033] hover:bg-[#f1f4fa] dark:text-white dark:hover:bg-[#1d2738]"
                  >
                    <span>🌊 Emerald Coastline (Drone vs Wallpaper)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Storage Analytics Button */}
            <button
              onClick={() => {
                playClickSound();
                setShowAnalytics(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#e2e7ef] bg-white px-3 py-2 text-xs font-bold text-[#55637a] transition hover:border-[#1957d2] hover:text-[#1957d2] dark:border-[#2a3447] dark:bg-[#151c27] dark:text-[#9fb0cf]"
              title="Storage Analytics & Visual Charts"
            >
              <BarChart3 className="h-3.5 w-3.5 text-[#1957d2] dark:text-[#7ba6ff]" />
              <span className="hidden md:inline">Analytics</span>
            </button>

            {/* Speed Benchmark Button */}
            <button
              onClick={() => {
                playClickSound();
                setShowBenchmark(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#e2e7ef] bg-white px-3 py-2 text-xs font-bold text-[#55637a] transition hover:border-[#1957d2] hover:text-[#1957d2] dark:border-[#2a3447] dark:bg-[#151c27] dark:text-[#9fb0cf]"
              title="Run Speed Benchmark"
            >
              <Zap className="h-3.5 w-3.5 text-[#f25b3d]" />
              <span className="hidden lg:inline">Speed Test</span>
            </button>

            {/* Dark / Light Toggle */}
            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e2e7ef] bg-white text-[#55637a] transition hover:border-[#1957d2] hover:text-[#1957d2] dark:border-[#2a3447] dark:bg-[#151c27] dark:text-[#9fb0cf]"
              aria-label="Toggle Theme"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            {/* Scan History Button */}
            <button
              onClick={() => setShowHistory(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#e2e7ef] bg-white px-3 py-2 text-xs font-bold text-[#55637a] transition hover:border-[#1957d2] hover:text-[#1957d2] dark:border-[#2a3447] dark:bg-[#151c27] dark:text-[#9fb0cf]"
              title="View past scans"
            >
              <History className="h-3.5 w-3.5" />
              <span className="hidden md:inline">History</span>
            </button>

            {/* User Account / Email with Hover Logout */}
            {isAuthenticated && user ? (
              <div className="relative group">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="inline-flex items-center gap-2 rounded-full border border-[#bed0fb] bg-[#eef3ff] py-1.5 pl-2.5 pr-3 text-xs font-bold text-[#1957d2] transition hover:border-[#1957d2] hover:bg-[#e2ecff] dark:border-[#29427b] dark:bg-[#16274a] dark:text-[#7ba6ff] dark:hover:bg-[#1f335e]"
                  title="Click or hover to view details / Log out"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1957d2] text-[10px] text-white transition-colors group-hover:bg-[#1146b5]">
                    {user.email ? user.email[0].toUpperCase() : (user.name ? user.name[0].toUpperCase() : "U")}
                  </div>
                  <span className="max-w-[180px] sm:max-w-[220px] truncate text-xs font-semibold">
                    {user.email || user.name}
                  </span>
                  {user.role === "admin" && (
                    <Crown className="h-3 w-3 text-amber-500 shrink-0" />
                  )}
                  <ChevronDown className="h-3 w-3 shrink-0 transition-transform duration-200 group-hover:rotate-180" />
                </button>

                {/* Hover & Click Dropdown Menu */}
                <div
                  className={`transition-all duration-200 absolute right-0 top-full z-50 pt-2 w-64 ${showUserMenu
                    ? "visible opacity-100 pointer-events-auto"
                    : "invisible opacity-0 pointer-events-none group-hover:visible group-hover:opacity-100 group-hover:pointer-events-auto"
                    }`}
                >
                  <div className="rounded-2xl border border-[#e2e7ef] bg-white p-3 shadow-xl dark:border-[#2a374c] dark:bg-[#151c27]">
                    {/* User Details */}
                    <div className="border-b border-[#f1f4f8] pb-2.5 px-1 dark:border-[#1e2736]">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#172033] dark:text-white truncate">
                        <Mail className="h-4 w-4 text-[#1957d2] dark:text-[#7ba6ff] shrink-0" />
                        <span className="truncate">{user.email || "No email"}</span>
                      </div>
                      <p className="text-[11px] text-[#7c8799] dark:text-[#8a98b0] mt-1 pl-6 truncate">
                        {user.name || "Signed-in User"}
                      </p>
                      <div className="mt-2 pl-6">
                        <Badge tone={user.role === "admin" ? "coral" : "blue"}>
                          {user.role === "admin" ? "Admin Mode" : "User Mode"}
                        </Badge>
                      </div>
                    </div>

                    {/* Menu Actions */}
                    <div className="pt-2 space-y-1">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowHistory(true);
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-[#172033] hover:bg-[#f1f4fa] dark:text-white dark:hover:bg-[#1d2738] transition-colors"
                      >
                        <History className="h-3.5 w-3.5 text-[#1957d2] dark:text-[#7ba6ff]" />
                        Cloud Scan History
                      </button>

                      <button
                        onClick={async () => {
                          setShowUserMenu(false);
                          await logout();
                          toast.success("Signed out successfully");
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 transition-colors"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Log Out
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAuthTab("login");
                  setShowAuthModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#bed0fb] bg-[#eef3ff] px-4 py-2 text-xs font-bold text-[#1957d2] transition hover:border-[#1957d2] hover:bg-[#dce7ff] dark:border-[#29427b] dark:bg-[#16274a] dark:text-[#7ba6ff] dark:hover:bg-[#1f345f]"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Login</span>
              </button>
            )}

            {/* Add Images CTA */}
            <button
              onClick={openPicker}
              className="group inline-flex items-center gap-2 rounded-full bg-[#1957d2] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#1146b5] active:scale-[0.97]"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              <span>Add files</span>
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative isolate overflow-hidden border-b border-[#ded8ce]/70 dark:border-[#1f2837]">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_80%_20%,rgba(25,87,210,0.08),transparent_32%),linear-gradient(180deg,#ffffff_0%,#fafbfc_100%)] dark:bg-[radial-gradient(circle_at_80%_20%,rgba(91,141,252,0.08),transparent_32%),linear-gradient(180deg,#0f141d_0%,#0c1017_100%)]" />

          <div className="mx-auto grid max-w-[1440px] gap-10 px-5 pb-12 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-10 lg:pb-16 lg:pt-14">
            <div className="max-w-[680px]">
              <div className="mb-6 flex flex-wrap items-center gap-2.5">
                <Badge tone="blue">
                  <Sparkles className="h-3 w-3" /> perceptual visual scan
                </Badge>
                <span className="text-xs font-semibold text-[#867d72] dark:text-[#8a98b0]">
                  100% client-side. Zero cloud uploads.
                </span>
              </div>

              <h1 className="max-w-[670px] text-[clamp(2.5rem,5.5vw,4.5rem)] font-black leading-[1.02] tracking-[-0.04em]">
                Find the doubles.
                <br />
                <span className="text-[#1957d2] dark:text-[#5b8dfc]">
                  Keep the originals.
                </span>
              </h1>

              <p className="mt-5 max-w-[520px] text-[15px] leading-7 text-[#5e697d] dark:text-[#9fb0cf]">
                Drop in a messy photo folder or ZIP archive and we’ll surface the
                lookalikes hiding in plain sight — resized, WhatsApp-compressed,
                color-shifted, and exact duplicates.
              </p>

              {/* Mode Switcher */}
              <div className="mt-6 grid max-w-[560px] gap-2.5 sm:grid-cols-2">
                <button
                  onClick={() => {
                    setMode("quick");
                    applySmartRule("camera");
                  }}
                  className={`rounded-[16px] border p-4 text-left transition ${mode === "quick"
                    ? "border-[#1957d2] bg-[#eef3ff] shadow-[0_8px_22px_rgba(25,87,210,0.10)] dark:border-[#5b8dfc] dark:bg-[#152342]"
                    : "border-[#e4e8ee] bg-white hover:border-[#b7c7ec] dark:border-[#222c3c] dark:bg-[#131923] dark:hover:border-[#3a4860]"
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-extrabold text-[#172033] dark:text-white">
                      Quick Clean
                    </span>
                    <Zap className="h-4 w-4 text-[#1957d2] dark:text-[#5b8dfc]" />
                  </div>
                  <p className="mt-1 text-[11px] leading-5 text-[#7c8799] dark:text-[#8a98b0]">
                    Fast cleanup with safe camera-first auto recommendations.
                  </p>
                </button>

                <button
                  onClick={() => setMode("careful")}
                  className={`rounded-[16px] border p-4 text-left transition ${mode === "careful"
                    ? "border-[#1957d2] bg-[#eef3ff] shadow-[0_8px_22px_rgba(25,87,210,0.10)] dark:border-[#5b8dfc] dark:bg-[#152342]"
                    : "border-[#e4e8ee] bg-white hover:border-[#b7c7ec] dark:border-[#222c3c] dark:bg-[#131923] dark:hover:border-[#3a4860]"
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-extrabold text-[#172033] dark:text-white">
                      Careful Review
                    </span>
                    <Eye className="h-4 w-4 text-[#1957d2] dark:text-[#5b8dfc]" />
                  </div>
                  <p className="mt-1 text-[11px] leading-5 text-[#7c8799] dark:text-[#8a98b0]">
                    Inspect every candidate side by side and choose each keeper.
                  </p>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button
                  onClick={openPicker}
                  className="group inline-flex items-center gap-2.5 rounded-full bg-[#1957d2] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_26px_rgba(25,87,210,0.25)] transition hover:-translate-y-0.5 hover:bg-[#1146b5] active:scale-[0.97] dark:bg-[#2563eb] dark:hover:bg-[#1d4ed8]"
                >
                  <UploadCloud className="h-4 w-4" /> Select Images
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>

                {/* <button
                  onClick={() => folderInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-full border border-[#bed0fb] bg-white px-4 py-3 text-sm font-bold text-[#1957d2] transition hover:bg-[#eef3ff] active:scale-[0.97] dark:border-[#29427b] dark:bg-[#131923] dark:text-[#7ba6ff] dark:hover:bg-[#1b2536]"
                >
                  <FolderOpen className="h-4 w-4" /> Whole Folder
                </button> */}

                <button
                  onClick={() => handleLoadSamplePreset("all")}
                  className="inline-flex items-center gap-2 rounded-full border border-[#dec7f7] bg-[#f7f0ff] px-4 py-3 text-sm font-bold text-[#7828c8] transition hover:bg-[#efe0ff] active:scale-[0.97] dark:border-[#4d1e70] dark:bg-[#201030] dark:text-[#c582fa] dark:hover:bg-[#2e1545]"
                >
                  <Sparkles className="h-4 w-4" /> 1-Click Demo
                </button>
              </div>

              <div className="mt-8 flex items-center gap-6 text-[11px] font-semibold text-[#8b8379] dark:text-[#7d8a9e]">
                <span className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-[#f25b3d]" /> Blazing fast (50–100 files/sec)
                </span>
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#1957d2] dark:text-[#5b8dfc]" />{" "}
                  Never leaves your browser
                </span>
              </div>
            </div>

            {/* Drag and Drop Zone */}
            <div
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={openPicker}
              className={`relative min-h-[340px] cursor-pointer overflow-hidden rounded-[28px] border-2 border-dashed ${isDragging
                ? "border-[#1957d2] bg-[#eaf0ff]/90 dark:border-[#5b8dfc] dark:bg-[#172544]/90"
                : "border-[#cfd8e5] bg-white/70 hover:border-[#1957d2] dark:border-[#2a374c] dark:bg-[#121822]/80 dark:hover:border-[#5b8dfc]"
                } p-6 shadow-[0_20px_50px_rgba(25,45,80,0.06)] backdrop-blur-sm transition lg:min-h-[390px]`}
            >
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/*,.zip,application/zip,application/x-zip-compressed"
                onClick={(event) => event.stopPropagation()}
                onChange={onInputChange}
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
              />
              <input
                ref={folderInputRef}
                type="file"
                multiple
                {...({
                  webkitdirectory: "",
                  directory: "",
                } as React.InputHTMLAttributes<HTMLInputElement>)}
                onChange={onFolderChange}
                className="hidden"
              />

              <div className="absolute right-5 top-5 flex items-center gap-1.5 rounded-full border border-[#e2e7ef] bg-white/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#777066] dark:border-[#2a3447] dark:bg-[#18202c]/80 dark:text-[#8a98b0]">
                <FileArchive className="h-3.5 w-3.5" /> JPG · PNG · WEBP · ZIP
              </div>

              <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center">
                <div className="relative mb-6 h-24 w-40">
                  <div className="absolute left-1 top-4 flex h-20 w-20 -rotate-12 items-center justify-center overflow-hidden rounded-[16px] border-4 border-white bg-[#eef3ff] text-[#1957d2] shadow-md dark:border-[#151c27] dark:bg-[#16274a] dark:text-[#5b8dfc]">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                  <div className="absolute right-1 top-0 flex h-20 w-20 rotate-6 items-center justify-center overflow-hidden rounded-[16px] border-4 border-white bg-[#f1f3f6] text-[#7c8799] shadow-md dark:border-[#151c27] dark:bg-[#1a2333] dark:text-[#8a98b0]">
                    <Grid2x2Plus className="h-8 w-8" />
                  </div>
                  <div className="absolute bottom-[-2px] left-[46px] flex h-12 w-12 items-center justify-center rounded-xl border-4 border-white bg-[#1957d2] text-white shadow-lg dark:border-[#151c27]">
                    <ScanSearch className="h-5 w-5" />
                  </div>
                </div>

                <h2 className="text-[24px] font-black tracking-[-0.03em]">
                  Drop your photos or ZIP here
                </h2>
                <p className="mt-2 text-xs leading-5 text-[#7c8799] dark:text-[#8a98b0]">
                  Select individual files, a whole folder, or a ZIP archive
                  <br />
                  Everything runs strictly inside your local browser
                </p>

                {isScanning && (
                  <div className="mt-5 w-full max-w-[280px]">
                    <div className="mb-2 flex justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-[#1957d2] dark:text-[#5b8dfc]">
                      <span>{scanMessage}</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#dfe5f4] dark:bg-[#202b3c]">
                      <div
                        className="h-full rounded-full bg-[#1957d2] transition-all duration-300 dark:bg-[#5b8dfc]"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {!isScanning && (
                  <div className="mt-5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.13em] text-[#1957d2] dark:text-[#5b8dfc]">
                    <FolderOpen className="h-4 w-4" /> Click or drag files to start
                  </div>
                )}
              </div>

              <div className="absolute bottom-4 left-5 flex items-center gap-2 text-[10px] font-semibold text-[#8b97ab] dark:text-[#67758a]">
                <LockKeyhole className="h-3.5 w-3.5 text-[#36a76b]" /> on-device processing
              </div>
            </div>
          </div>
        </section>

        {/* Duplicate Clusters Section */}
        <section
          id="clusters"
          className="mx-auto max-w-[1440px] px-5 pb-20 pt-8 lg:px-10 lg:pt-12"
        >
          {/* Section Header */}
          <div className="mb-6 flex flex-col justify-between gap-4 border-b border-[#e8ebf0] pb-5 lg:flex-row lg:items-end dark:border-[#1e2736]">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#f25b3d]" />
                <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#b34a36] dark:text-[#fa8269]">
                  {mode === "quick"
                    ? "Quick Clean Workspace"
                    : "Careful Review Workspace"}
                </span>
              </div>
              <h2 className="text-[34px] font-black leading-none tracking-[-0.04em]">
                Duplicate Clusters
              </h2>
              <p className="mt-2 text-sm text-[#6c788d] dark:text-[#8a98b0]">
                {clusters.length ? (
                  <>
                    Found{" "}
                    <span className="font-bold text-[#172033] dark:text-white">
                      {clusters.length} groups
                    </span>{" "}
                    ({clusters.reduce((s, c) => s + c.assets.length, 0)} files). Choose a keeper
                    in each row.
                  </>
                ) : (
                  "Ready to scan photos or load demo data."
                )}
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1 rounded-full border border-[#e2e7ef] bg-white p-1 text-[10px] font-bold dark:border-[#2a3447] dark:bg-[#131923]">
              <button
                onClick={() => setFilter("all")}
                className={`rounded-full px-3 py-1.5 transition ${filter === "all"
                  ? "bg-[#1957d2] text-white"
                  : "text-[#6c788d] hover:text-[#172033] dark:text-[#8a98b0] dark:hover:text-white"
                  }`}
              >
                All ({clusters.length})
              </button>
              <button
                onClick={() => setFilter("review")}
                className={`rounded-full px-3 py-1.5 transition ${filter === "review"
                  ? "bg-[#1957d2] text-white"
                  : "text-[#6c788d] hover:text-[#172033] dark:text-[#8a98b0] dark:hover:text-white"
                  }`}
              >
                To Review ({clusters.filter((c) => !keepMap[c.id]).length})
              </button>
              <button
                onClick={() => setFilter("reviewed")}
                className={`rounded-full px-3 py-1.5 transition ${filter === "reviewed"
                  ? "bg-[#1957d2] text-white"
                  : "text-[#6c788d] hover:text-[#172033] dark:text-[#8a98b0] dark:hover:text-white"
                  }`}
              >
                Reviewed ({reviewedCount})
              </button>
              <button
                onClick={() => setFilter("high-match")}
                className={`rounded-full px-3 py-1.5 transition ${filter === "high-match"
                  ? "bg-[#1957d2] text-white"
                  : "text-[#6c788d] hover:text-[#172033] dark:text-[#8a98b0] dark:hover:text-white"
                  }`}
              >
                ≥90% Match
              </button>
            </div>
          </div>

          {/* Smart Rules & Search Toolbar */}
          <div className="mb-6 grid gap-4 rounded-[20px] border border-[#e4e8ee] bg-white p-4 lg:grid-cols-[1fr_auto] lg:items-center dark:border-[#222c3c] dark:bg-[#131923]">
            {/* Search Input */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8b97ab]" />
                <input
                  type="text"
                  placeholder="Search filename or folder..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-full border border-[#e2e7ef] bg-[#f8fafc] py-1.5 pl-9 pr-4 text-xs font-medium focus:border-[#1957d2] focus:outline-none dark:border-[#2a374c] dark:bg-[#192230] dark:text-white"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8b97ab] hover:text-black dark:hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Sort selector */}
              <div className="flex items-center gap-1.5 text-xs text-[#6c788d] dark:text-[#8a98b0]">
                <FilterIcon className="h-3.5 w-3.5" />
                <span className="font-semibold">Sort:</span>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  className="rounded-full border border-[#e2e7ef] bg-[#f8fafc] px-2.5 py-1 text-xs font-bold text-[#172033] focus:outline-none dark:border-[#2a374c] dark:bg-[#192230] dark:text-white"
                >
                  <option value="reclaim">Reclaimable Space</option>
                  <option value="similarity">Similarity %</option>
                  <option value="count">File Count</option>
                  <option value="name">Cluster Name</option>
                </select>
              </div>
            </div>

            {/* Smart Rules Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-[#6c788d] dark:text-[#8a98b0]">
                Smart Rules:
              </span>
              <button
                onClick={() => applySmartRule("camera")}
                className={`rounded-full px-3 py-1.5 text-[10px] font-bold transition ${smartRule === "camera"
                  ? "bg-[#1957d2] text-white"
                  : "border border-[#e2e7ef] bg-[#f8fafc] text-[#55637a] hover:border-[#1957d2] hover:text-[#1957d2] dark:border-[#2a374c] dark:bg-[#192230] dark:text-[#9fb0cf]"
                  }`}
                title="Prefer Camera original folder"
              >
                Prefer Camera
              </button>
              <button
                onClick={() => applySmartRule("quality")}
                className={`rounded-full px-3 py-1.5 text-[10px] font-bold transition ${smartRule === "quality"
                  ? "bg-[#1957d2] text-white"
                  : "border border-[#e2e7ef] bg-[#f8fafc] text-[#55637a] hover:border-[#1957d2] hover:text-[#1957d2] dark:border-[#2a374c] dark:bg-[#192230] dark:text-[#9fb0cf]"
                  }`}
                title="Keep highest resolution and quality score"
              >
                Highest Quality
              </button>
              <button
                onClick={() => applySmartRule("largest")}
                className={`rounded-full px-3 py-1.5 text-[10px] font-bold transition ${smartRule === "largest"
                  ? "bg-[#1957d2] text-white"
                  : "border border-[#e2e7ef] bg-[#f8fafc] text-[#55637a] hover:border-[#1957d2] hover:text-[#1957d2] dark:border-[#2a374c] dark:bg-[#192230] dark:text-[#9fb0cf]"
                  }`}
                title="Keep largest file size"
              >
                Largest Size
              </button>
            </div>
          </div>

          {/* Summary & Export Bar */}
          {clusters.length > 0 && (
            <div className="mb-6 flex flex-col gap-4 rounded-[22px] border border-[#d2e0fb] bg-[#f0f5ff] p-4.5 sm:flex-row sm:items-center sm:justify-between dark:border-[#1d3568] dark:bg-[#0f1d38]">
              <div className="flex items-center gap-3.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1957d2] text-white shadow-sm dark:bg-[#2563eb]">
                  <HardDrive className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-black text-[#172033] dark:text-white">
                    {formatBytes(removalBytes)} Reclaimable Storage
                  </p>
                  <p className="text-xs text-[#55637a] dark:text-[#8a98b0]">
                    {unwantedAssets().length} duplicate files selected for removal ·{" "}
                    {keeperAssets().length} keepers preserved
                  </p>
                </div>
              </div>

              {/* Export Actions Suite */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Visual HTML Report */}
                <button
                  onClick={handleExportHtmlReport}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#1957d2] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#1146b5]"
                  title="Generate Visual Audit Report in new tab"
                >
                  <Printer className="h-3.5 w-3.5" /> HTML Report
                </button>

                {/* Export Kept ZIP */}
                <button
                  onClick={() => void exportKeeperZipArchive(keeperAssets())}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#bed0fb] bg-white px-3.5 py-2 text-xs font-bold text-[#1957d2] transition hover:bg-[#eef3ff] dark:border-[#29427b] dark:bg-[#151c27] dark:text-[#7ba6ff]"
                >
                  <PackageOpen className="h-3.5 w-3.5" /> Keepers ZIP
                </button>

                {/* More Exports Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="inline-flex items-center gap-1 rounded-full border border-[#cfd6e2] bg-white px-3 py-2 text-xs font-bold text-[#55637a] transition hover:border-[#1957d2] hover:text-[#1957d2] dark:border-[#2a3447] dark:bg-[#151c27] dark:text-[#9fb0cf]"
                  >
                    <Download className="h-3.5 w-3.5" /> Scripts & Manifests
                    <ChevronDown className="h-3 w-3" />
                  </button>

                  {showExportMenu && (
                    <div className="absolute right-0 top-full z-30 mt-1.5 w-64 rounded-2xl border border-[#e2e7ef] bg-white p-2 shadow-xl dark:border-[#2a374c] dark:bg-[#151c27]">
                      <button
                        onClick={() => {
                          handleExportPowershell();
                          setShowExportMenu(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-[#172033] hover:bg-[#f1f4fa] dark:text-white dark:hover:bg-[#1d2738]"
                      >
                        <Terminal className="h-3.5 w-3.5 text-[#1957d2]" />
                        Windows PowerShell (.ps1)
                      </button>

                      <button
                        onClick={() => {
                          handleExportPython();
                          setShowExportMenu(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-[#172033] hover:bg-[#f1f4fa] dark:text-white dark:hover:bg-[#1d2738]"
                      >
                        <Code2 className="h-3.5 w-3.5 text-[#36a76b]" />
                        Python 3 Quarantine Script (.py)
                      </button>

                      <button
                        onClick={() => {
                          handleExportBash();
                          setShowExportMenu(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-[#172033] hover:bg-[#f1f4fa] dark:text-white dark:hover:bg-[#1d2738]"
                      >
                        <Terminal className="h-3.5 w-3.5 text-[#27764d]" />
                        Linux / macOS Bash (.sh)
                      </button>

                      <button
                        onClick={() => {
                          handleExportBatch();
                          setShowExportMenu(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-[#172033] hover:bg-[#f1f4fa] dark:text-white dark:hover:bg-[#1d2738]"
                      >
                        <Terminal className="h-3.5 w-3.5 text-[#f25b3d]" />
                        Windows Batch (.bat)
                      </button>

                      <button
                        onClick={() => {
                          handleExportCsv();
                          setShowExportMenu(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-[#172033] hover:bg-[#f1f4fa] dark:text-white dark:hover:bg-[#1d2738]"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5 text-[#7828c8]" />
                        Spreadsheet CSV (.csv)
                      </button>

                      <button
                        onClick={() => {
                          handleExportTxt();
                          setShowExportMenu(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-[#172033] hover:bg-[#f1f4fa] dark:text-white dark:hover:bg-[#1d2738]"
                      >
                        <FileText className="h-3.5 w-3.5 text-[#1957d2]" />
                        Text Manifest (.txt)
                      </button>

                      <button
                        onClick={() => {
                          copyFilePathsToClipboard();
                          setShowExportMenu(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-[#172033] hover:bg-[#f1f4fa] dark:text-white dark:hover:bg-[#1d2738]"
                      >
                        <Copy className="h-3.5 w-3.5 text-[#55637a]" />
                        Copy File Paths to Clipboard
                      </button>

                      <button
                        onClick={() => {
                          void exportDuplicatesZipArchive(unwantedAssets());
                          setShowExportMenu(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-[#172033] hover:bg-[#f1f4fa] dark:text-white dark:hover:bg-[#1d2738]"
                      >
                        <FileArchive className="h-3.5 w-3.5 text-[#c7472e]" />
                        Archive Duplicates Backup (.zip)
                      </button>
                    </div>
                  )}
                </div>

                {/* Reset button */}
                <button
                  onClick={resetAll}
                  className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400"
                  title="Clear workspace"
                >
                  <RefreshCw className="h-3 w-3" /> Reset
                </button>
              </div>
            </div>
          )}

          {/* Main Cluster Grid and Sidebar */}
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_310px]">
            {/* Cluster Cards List */}
            <div className="space-y-3.5">
              {!clusters.length && (
                <div className="rounded-[24px] border border-dashed border-[#cfd6e2] bg-white p-12 text-center dark:border-[#222c3c] dark:bg-[#131923]">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef3ff] text-[#1957d2] dark:bg-[#16274a] dark:text-[#5b8dfc]">
                    <ScanSearch className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-base font-extrabold text-[#172033] dark:text-white">
                    {hasScanned
                      ? "No duplicate groups found"
                      : "No duplicate groups loaded yet"}
                  </h3>
                  <p className="mx-auto mt-2 max-w-[380px] text-xs leading-5 text-[#7c8799] dark:text-[#8a98b0]">
                    {hasScanned
                      ? "Images do not exceed the similarity threshold. You can lower the threshold slider on the right or add more images."
                      : "Click 'Try Demo Photos' above for an instant preview, or drop your photo collection to scan."}
                  </p>
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={() => handleLoadSamplePreset("all")}
                      className="rounded-full bg-[#1957d2] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#1146b5]"
                    >
                      Load Demo Dataset
                    </button>
                    <button
                      onClick={openPicker}
                      className="rounded-full border border-[#cfd6e2] bg-white px-5 py-2.5 text-xs font-bold text-[#55637a] transition hover:border-[#1957d2] dark:border-[#2a3447] dark:bg-[#192230] dark:text-white"
                    >
                      Scan Local Folder
                    </button>
                  </div>
                </div>
              )}

              {displayedClusters.map((cluster) => {
                const keeper =
                  keepMap[cluster.id] ??
                  cluster.assets.find((asset) => asset.recommendation === "keep")
                    ?.id ??
                  cluster.assets[0]?.id;

                const clusterReclaim = cluster.assets.reduce(
                  (sum, a) => sum + (a.id === keeper ? 0 : a.size),
                  0
                );

                return (
                  <div
                    key={cluster.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      playClickSound();
                      setSelectedClusterId(cluster.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ")
                        setSelectedClusterId(cluster.id);
                    }}
                    className="group grid w-full cursor-pointer gap-4 rounded-[22px] border border-[#e4e8ee] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#b7c7ec] hover:shadow-[0_12px_30px_rgba(25,45,80,0.06)] sm:grid-cols-[180px_minmax(0,1fr)_130px] sm:items-center dark:border-[#222c3c] dark:bg-[#131923] dark:hover:border-[#384a6b]"
                  >
                    {/* Thumbnails Row */}
                    <div className="flex -space-x-3 overflow-hidden pl-1 sm:pl-0">
                      {cluster.assets.slice(0, 4).map((asset, index) => (
                        <div
                          key={asset.id}
                          className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-[14px] border-[3px] border-white bg-[#ece7de] shadow-sm dark:border-[#131923] ${index === 0 ? "z-10" : ""
                            }`}
                        >
                          <img
                            src={asset.src}
                            alt=""
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          />
                          {asset.id === keeper && (
                            <span className="absolute bottom-1 left-1 rounded-full bg-[#eaf8f0] px-1.5 py-0.5 text-[8px] font-extrabold uppercase text-[#27764d] shadow-sm dark:bg-[#102e1f] dark:text-[#58d492]">
                              keep
                            </span>
                          )}
                        </div>
                      ))}
                      {cluster.assets.length > 4 && (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[14px] border-[3px] border-white bg-[#172033] text-[10px] font-bold text-white shadow-sm dark:border-[#131923]">
                          +{cluster.assets.length - 4}
                        </div>
                      )}
                    </div>

                    {/* Cluster Information */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${cluster.accent === "coral"
                            ? "bg-[#f25b3d]"
                            : cluster.accent === "blue"
                              ? "bg-[#1957d2]"
                              : "bg-[#292621] dark:bg-[#9fb0cf]"
                            }`}
                        />
                        <h3 className="truncate text-sm font-black text-[#172033] dark:text-white">
                          {cluster.label}
                        </h3>
                        {keepMap[cluster.id] ? (
                          <Badge tone="green">
                            <Check className="h-2.5 w-2.5" /> reviewed
                          </Badge>
                        ) : (
                          <Badge tone="neutral">unreviewed</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-[#7c8799] dark:text-[#8a98b0]">
                        {cluster.note}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge tone="coral">
                          {duplicateTypeFor(
                            cluster.assets[1] ?? cluster.assets[0]
                          )}
                        </Badge>
                        <Badge tone="neutral">
                          <FolderTree className="h-2.5 w-2.5" />{" "}
                          {sourceFolderFor(cluster.assets[0])}
                        </Badge>
                        <Badge tone="blue">
                          Reclaim {formatBytes(clusterReclaim)}
                        </Badge>
                      </div>
                      <p className="mt-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#9ca3af]">
                        {cluster.assets.length} files ·{" "}
                        {formatBytes(
                          cluster.assets.reduce((sum, asset) => sum + asset.size, 0)
                        )}
                      </p>
                    </div>

                    {/* Match Score & Compare Button */}
                    <div className="flex items-center justify-between gap-3 border-t border-[#f1f4f8] pt-3 sm:block sm:border-0 sm:pt-0 sm:text-right dark:border-[#1e2736]">
                      <div>
                        <p className="text-lg font-black tracking-[-0.04em] text-[#1957d2] dark:text-[#5b8dfc]">
                          {cluster.similarity}%
                        </p>
                        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#8b97ab]">
                          match
                        </p>
                      </div>
                      <div className="mt-2 flex items-center justify-end gap-1.5">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            playClickSound();
                            setSelectedClusterId(cluster.id);
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-[#bed0fb] bg-[#eaf0ff] px-3 py-1.5 text-[10px] font-extrabold text-[#1957d2] transition hover:bg-[#d8e5ff] dark:border-[#29427b] dark:bg-[#132247] dark:text-[#7ba6ff]"
                        >
                          Compare <Eye className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            dismissCluster(cluster.id);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-[#8b97ab] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                          title="Dismiss / Not duplicates"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {clusters.length > 0 && (
                <button
                  onClick={openPicker}
                  className="flex w-full items-center justify-center gap-2 rounded-[20px] border border-dashed border-[#cfd6e2] bg-transparent px-5 py-4 text-xs font-bold text-[#6c788d] transition hover:border-[#1957d2] hover:bg-[#eaf0ff]/30 hover:text-[#1957d2] dark:border-[#2a374c] dark:text-[#8a98b0] dark:hover:border-[#5b8dfc]"
                >
                  <Grid2x2Plus className="h-4 w-4" /> Scan more images
                </button>
              )}
            </div>

            {/* Sidebar Controls */}
            <aside className="space-y-4">
              {/* Storage Reclaim Card */}
              <div className="rounded-[22px] border border-[#e4e8ee] bg-white p-5 shadow-sm dark:border-[#222c3c] dark:bg-[#131923]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#8b97ab]">
                      Storage to Reclaim
                    </p>
                    <p className="mt-1.5 text-[36px] font-black leading-none tracking-[-0.05em] text-[#172033] dark:text-white">
                      {formatBytes(removalBytes)}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff0eb] text-[#f25b3d] dark:bg-[#38150f] dark:text-[#fa8269]">
                    <HardDrive className="h-5 w-5" />
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#f1f3f6] dark:bg-[#1a2333]">
                  <div
                    className="h-full rounded-full bg-[#f25b3d] transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          10,
                          Math.round(
                            (removalBytes /
                              Math.max(
                                clusters
                                  .flatMap((c) => c.assets)
                                  .reduce((sum, asset) => sum + asset.size, 0),
                                1
                              )) *
                            100
                          )
                        )
                      )}%`,
                    }}
                  />
                </div>

                <div className="mt-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em]">
                  <span className="text-[#8b97ab]">Reviewed</span>
                  <span className="text-[#c7472e] dark:text-[#fa8269]">
                    {reviewedCount} / {clusters.length} groups
                  </span>
                </div>
              </div>

              {/* Threshold Slider Settings Card */}
              <div className="rounded-[22px] border border-[#e4e8ee] bg-white p-5 shadow-sm dark:border-[#222c3c] dark:bg-[#131923]">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#8b97ab]">
                    Similarity Threshold
                  </p>
                  <SlidersHorizontal className="h-4 w-4 text-[#1957d2] dark:text-[#5b8dfc]" />
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#172033] dark:text-white">
                    Sensitivity
                  </span>
                  <span className="rounded-full bg-[#eef3ff] px-2.5 py-0.5 text-[10px] font-bold text-[#1957d2] dark:bg-[#16274a] dark:text-[#7ba6ff]">
                    {threshold} / 20 ({Math.max(70, 100 - threshold * 2)}% min match)
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <input
                    aria-label="Similarity threshold"
                    type="range"
                    min="4"
                    max="20"
                    value={threshold}
                    onChange={(event) =>
                      handleThresholdChange(Number(event.target.value))
                    }
                    className="w-full accent-[#1957d2]"
                  />
                </div>

                <div className="mt-2 flex justify-between text-[10px] text-[#7c8799] dark:text-[#8a98b0]">
                  <span>Strict (Exact copies)</span>
                  <span>Relaxed (Resizes/Edits)</span>
                </div>
              </div>

              {/* Safe Mode Notice */}
              <div className="rounded-[22px] border border-[#e4e8ee] bg-[#f8fafc] p-5 dark:border-[#222c3c] dark:bg-[#101620]">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#27764d]" />
                  <div>
                    <p className="text-xs font-bold text-[#172033] dark:text-white">
                      Zero Accidental Deletions
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-[#6c788d] dark:text-[#8a98b0]">
                      Nothing is deleted directly from your hard drive without your
                      explicit export command or script review.
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        {/* How it works educational section */}
        <section id="how-it-works" className="border-t border-[#e8ebf0] bg-[#f4f7fb] dark:border-[#1e2736] dark:bg-[#0e131b]">
          <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-14 lg:grid-cols-[0.8fr_1.2fr] lg:px-10 lg:py-20">
            <div>
              <Badge tone="coral">
                <Sparkles className="h-3 w-3" /> perceptual hashing
              </Badge>
              <h2 className="mt-4 max-w-[420px] text-[36px] font-black leading-[1.05] tracking-[-0.04em]">
                Not just the same filename.
                <br />
                <span className="text-[#1957d2] dark:text-[#5b8dfc]">
                  The exact visual match.
                </span>
              </h2>
              <p className="mt-4 max-w-[360px] text-sm leading-6 text-[#6c788d] dark:text-[#8a98b0]">
                Duplicate Finder compares the actual light and color patterns of your
                photos rather than trusting file sizes or names alone.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[22px] border border-[#e4e8ee] bg-white p-5 shadow-sm dark:border-[#222c3c] dark:bg-[#131923]">
                <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf0ff] text-[#1957d2] dark:bg-[#16274a] dark:text-[#5b8dfc]">
                  <ScanSearch className="h-5 w-5" />
                </div>
                <p className="text-sm font-extrabold text-[#172033] dark:text-white">
                  1. Perceptual Fingerprint
                </p>
                <p className="mt-2 text-xs leading-5 text-[#6c788d] dark:text-[#8a98b0]">
                  Images are downscaled to 8×8 frequency maps entirely inside your
                  browser memory.
                </p>
              </div>

              <div className="rounded-[22px] border border-[#e4e8ee] bg-white p-5 shadow-sm dark:border-[#222c3c] dark:bg-[#131923]">
                <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff0eb] text-[#f25b3d] dark:bg-[#38150f] dark:text-[#fa8269]">
                  <ArrowLeftRight className="h-5 w-5" />
                </div>
                <p className="text-sm font-extrabold text-[#172033] dark:text-white">
                  2. Cluster & Group
                </p>
                <p className="mt-2 text-xs leading-5 text-[#6c788d] dark:text-[#8a98b0]">
                  Hamming distance algorithms group lookalikes, compressed social
                  exports, and copies together.
                </p>
              </div>

              <div className="rounded-[22px] border border-[#e4e8ee] bg-white p-5 shadow-sm dark:border-[#222c3c] dark:bg-[#131923]">
                <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf8f0] text-[#27764d] dark:bg-[#102e1f] dark:text-[#58d492]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <p className="text-sm font-extrabold text-[#172033] dark:text-white">
                  3. Export with Confidence
                </p>
                <p className="mt-2 text-xs leading-5 text-[#6c788d] dark:text-[#8a98b0]">
                  Download kept photos ZIP, Windows PowerShell cleanup script, Python quarantine utility, or
                  detailed audit CSV.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mx-auto flex max-w-[1440px] flex-col gap-4 border-t border-[#e8ebf0] px-5 py-8 text-[11px] font-semibold text-[#8b97ab] sm:flex-row sm:items-center sm:justify-between lg:px-10 dark:border-[#1e2736] dark:text-[#6c788d]">
        <div className="flex items-center gap-2">
          <LogoMark />
          <span>Duplicate Image Finder · Private Client-Side Cleaning</span>
        </div>
        <div className="flex items-center gap-5">
          <span></span>
          <button
            onClick={() => setShowInfo(true)}
            className="inline-flex items-center gap-1 transition hover:text-[#1957d2] dark:hover:text-[#5b8dfc]"
          >
            <CircleHelp className="h-3.5 w-3.5" />
          </button>
        </div>
      </footer>

      {/* Comparison Studio Modal */}
      {selectedCluster && (
        <ClusterComparisonModal
          cluster={selectedCluster}
          keepMap={keepMap}
          onSelectKeeper={setKeeper}
          onDismissCluster={dismissCluster}
          onClose={() => setSelectedClusterId(null)}
          formatBytes={formatBytes}
        />
      )}

      {/* Storage Analytics Modal */}
      <StorageAnalyticsModal
        isOpen={showAnalytics}
        onClose={() => setShowAnalytics(false)}
        clusters={clusters}
        keepMap={keepMap}
        formatBytes={formatBytes}
      />

      {/* Speed Benchmark Modal */}
      <BenchmarkModal
        isOpen={showBenchmark}
        onClose={() => setShowBenchmark(false)}
      />

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />

      {/* Auth / Login & Sign Up Modal */}
      {showAuthModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-[460px] rounded-[28px] border border-[#e4e8ee] bg-white p-6 shadow-2xl dark:border-[#2a374c] dark:bg-[#131923]">
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef3ff] text-[#1957d2] dark:bg-[#16274a] dark:text-[#5b8dfc]">
                  <UserIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-[#172033] dark:text-white">
                    {authTab === "login" ? "Login to Account" : "Create New Account"}
                  </h2>
                  <p className="mt-0.5 text-xs text-[#7c8799] dark:text-[#8a98b0]">
                    {authTab === "login"
                      ? "Access your cloud scan history and saved settings."
                      : "Register your account to save scans permanently."}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAuthModal(false)}
                className="rounded-full p-1.5 text-[#7c8799] hover:bg-[#f1f4f8] hover:text-black dark:hover:bg-[#1e2736] dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tab Switcher: Login vs Sign Up */}
            <div className="mt-5 grid grid-cols-2 gap-1 rounded-2xl bg-[#f1f4f8] p-1 dark:bg-[#1a2230]">
              <button
                type="button"
                onClick={() => setAuthTab("login")}
                className={`rounded-xl py-2 text-xs font-bold transition ${authTab === "login"
                  ? "bg-white text-[#1957d2] shadow-sm dark:bg-[#232f42] dark:text-white"
                  : "text-[#66768f] hover:text-black dark:text-[#8d9cb5] dark:hover:text-white"
                  }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setAuthTab("signup")}
                className={`rounded-xl py-2 text-xs font-bold transition ${authTab === "signup"
                  ? "bg-white text-[#1957d2] shadow-sm dark:bg-[#232f42] dark:text-white"
                  : "text-[#66768f] hover:text-black dark:text-[#8d9cb5] dark:hover:text-white"
                  }`}
              >
                Sign Up (New Account)
              </button>
            </div>

            {/* TAB 1: LOGIN */}
            {authTab === "login" && (
              <div className="mt-5 space-y-4">
                {/* 1-Click Demo Presets */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8b97ab]">
                    1-Click Fast Login
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleCustomLogin("dhruv@photoclean.io", "admin")}
                      disabled={isAuthenticating}
                      className="flex items-center gap-2.5 rounded-xl border border-[#d7e2ff] bg-[#f0f5ff] p-2.5 text-left transition hover:bg-[#e2ecff] dark:border-[#29427b] dark:bg-[#16274a] dark:hover:bg-[#1d3568]"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1957d2] text-xs font-bold text-white shrink-0">
                        D
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#172033] dark:text-white flex items-center gap-1 truncate">
                          Dhruv <Crown className="h-3 w-3 text-amber-500 shrink-0" />
                        </p>
                        <p className="text-[9px] text-[#55637a] dark:text-[#9fb0cf] truncate">
                          Admin
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCustomLogin("alex@lenscraft.com", "user")}
                      disabled={isAuthenticating}
                      className="flex items-center gap-2.5 rounded-xl border border-[#e2e7ef] bg-[#f8fafc] p-2.5 text-left transition hover:bg-[#f1f4f8] dark:border-[#2a374c] dark:bg-[#18202c] dark:hover:bg-[#202b3c]"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#36a76b] text-xs font-bold text-white shrink-0">
                        A
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#172033] dark:text-white truncate">
                          Alex Morgan
                        </p>
                        <p className="text-[9px] text-[#55637a] dark:text-[#9fb0cf] truncate">
                          User
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="relative flex items-center justify-center">
                  <div className="w-full border-t border-[#f1f4f8] dark:border-[#1e2736]"></div>
                  <span className="absolute bg-white px-2 text-[10px] font-bold uppercase tracking-wider text-[#8b97ab] dark:bg-[#131923]">
                    Or with email / name
                  </span>
                </div>

                {/* Login Form */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-[#172033] dark:text-white">
                      Email or Username
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. dhruv@photoclean.io or Dhruv"
                      value={authEmailInput}
                      onChange={(e) => setAuthEmailInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCustomLogin(authEmailInput, "user");
                      }}
                      className="mt-1 w-full rounded-xl border border-[#e2e7ef] bg-[#f8fafc] px-3.5 py-2.5 text-xs font-medium focus:border-[#1957d2] focus:outline-none dark:border-[#2a374c] dark:bg-[#18202c] dark:text-white"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCustomLogin(authEmailInput, "user")}
                    disabled={isAuthenticating || !authEmailInput.trim()}
                    className="w-full rounded-xl bg-[#1957d2] py-2.5 text-xs font-bold text-white shadow transition hover:bg-[#1146b5] disabled:opacity-50"
                  >
                    {isAuthenticating ? "Logging in..." : "Log In"}
                  </button>
                </div>

                {/* Switch to sign up link */}
                <p className="text-center text-xs text-[#7c8799] dark:text-[#8a98b0]">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setAuthTab("signup")}
                    className="font-bold text-[#1957d2] hover:underline dark:text-[#7ba6ff]"
                  >
                    Sign Up now
                  </button>
                </p>
              </div>
            )}

            {/* TAB 2: SIGN UP (NEW ACCOUNT) */}
            {authTab === "signup" && (
              <div className="mt-5 space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-[#172033] dark:text-white">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Dhruv Patel"
                      value={authNameInput}
                      onChange={(e) => setAuthNameInput(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#e2e7ef] bg-[#f8fafc] px-3.5 py-2.5 text-xs font-medium focus:border-[#1957d2] focus:outline-none dark:border-[#2a374c] dark:bg-[#18202c] dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#172033] dark:text-white">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. you@example.com"
                      value={authEmailInput}
                      onChange={(e) => setAuthEmailInput(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#e2e7ef] bg-[#f8fafc] px-3.5 py-2.5 text-xs font-medium focus:border-[#1957d2] focus:outline-none dark:border-[#2a374c] dark:bg-[#18202c] dark:text-white"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCustomRegister(authNameInput, authEmailInput)}
                    disabled={isAuthenticating || !authNameInput.trim() || !authEmailInput.trim()}
                    className="w-full rounded-xl bg-[#1957d2] py-2.5 text-xs font-bold text-white shadow transition hover:bg-[#1146b5] disabled:opacity-50"
                  >
                    {isAuthenticating ? "Creating Account..." : "Create Account & Sign In"}
                  </button>
                </div>

                {/* Switch to log in link */}
                <p className="text-center text-xs text-[#7c8799] dark:text-[#8a98b0]">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setAuthTab("login")}
                    className="font-bold text-[#1957d2] hover:underline dark:text-[#7ba6ff]"
                  >
                    Log In here
                  </button>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Privacy Dialog */}
      {showInfo && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-[480px] rounded-[24px] border border-[#e4e8ee] bg-white p-6 shadow-2xl dark:border-[#2a374c] dark:bg-[#131923]">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eaf8f0] text-[#27764d] dark:bg-[#102e1f] dark:text-[#58d492]">
                  <LockKeyhole className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-[#172033] dark:text-white">
                    Private by Design
                  </h2>
                  <p className="mt-0.5 text-xs text-[#7c8799] dark:text-[#8a98b0]">
                    Your photos never leave this computer.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInfo(false)}
                className="text-[#7c8799] hover:text-black dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 space-y-3 text-sm leading-6 text-[#55637a] dark:text-[#9fb0cf]">
              <p>
                Duplicate Image Finder calculates image fingerprints directly inside your
                browser using HTML5 Canvas. There is no server upload endpoint and no
                cloud transmission of your photo contents.
              </p>
              <p>
                When you load a ZIP, it is extracted into local browser memory. When you
                close or refresh the tab, the memory is cleared.
              </p>
            </div>

            <div className="mt-6 flex items-center gap-2 rounded-xl bg-[#f1f4f8] p-3 text-xs font-semibold text-[#55637a] dark:bg-[#18202c] dark:text-[#8a98b0]">
              <Info className="h-4 w-4 text-[#1957d2]" /> Nothing on your computer is
              deleted automatically.
            </div>

            <button
              onClick={() => setShowInfo(false)}
              className="mt-6 w-full rounded-full bg-[#1957d2] py-3 text-xs font-bold text-white transition hover:bg-[#1146b5]"
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* History Dialog */}
      {showHistory && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-[560px] rounded-[24px] border border-[#e4e8ee] bg-white p-6 shadow-2xl dark:border-[#2a374c] dark:bg-[#131923]">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef3ff] text-[#1957d2] dark:bg-[#16274a] dark:text-[#5b8dfc]">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-[#172033] dark:text-white">
                    Scan History
                  </h2>
                  <p className="mt-0.5 text-xs text-[#7c8799] dark:text-[#8a98b0]">
                    Previous scans stored for your session.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="text-[#7c8799] hover:text-black dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 max-h-[360px] space-y-3 overflow-y-auto pr-1">
              {localHistory.some((s) =>
                s.clusters?.some((c) => c.assets?.some((a) => a.src?.startsWith("blob:")))
              ) && (
                <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>Previous session scans used temporary browser memory. Run a new scan for persistent photos!</span>
                  </div>
                  <button
                    onClick={() => {
                      const filtered = localHistory.filter(
                        (s) => !s.clusters?.some((c) => c.assets?.some((a) => a.src?.startsWith("blob:")))
                      );
                      setLocalHistory(filtered);
                      localStorage.setItem("duplicate_finder_history", JSON.stringify(filtered));
                      toast.info("Cleared outdated session scans");
                    }}
                    className="ml-2 whitespace-nowrap rounded-lg bg-amber-200/80 px-2 py-1 font-bold text-amber-900 transition hover:bg-amber-300/80 dark:bg-amber-900/60 dark:text-amber-100"
                  >
                    Clean Outdated
                  </button>
                </div>
              )}

              {!localHistory.length && (
                <div className="py-8 text-center text-xs text-[#7c8799] dark:text-[#8a98b0]">
                  No saved scans yet. Scans are saved automatically.
                </div>
              )}

              {localHistory.map((scan) => {
                const allPhotos = (scan.clusters || []).flatMap((c) => c.assets || []);
                return (
                  <div
                    key={scan.id}
                    className="flex flex-col gap-3 rounded-2xl border border-[#e4e8ee] bg-[#f8fafc] p-4 transition-all hover:border-[#ccd5e2] dark:border-[#222c3c] dark:bg-[#18202c] dark:hover:border-[#2f3d52]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-[#172033] dark:text-white">
                          {scan.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#7c8799] dark:text-[#8a98b0]">
                          {scan.date} · {scan.fileCount} files · {scan.duplicateGroupCount} groups
                        </p>
                        <p className="mt-0.5 text-[11px] font-semibold text-[#1957d2] dark:text-[#5b8dfc]">
                          {formatBytes(scan.reclaimableBytes)} reclaimable
                        </p>
                      </div>
                      <button
                        onClick={() => loadSavedScan(scan)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#1957d2] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#1146b5]"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Restore
                      </button>
                    </div>

                    {/* Photos Thumbnail Strip */}
                    {allPhotos.length > 0 && (
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5">
                        {allPhotos.slice(0, 7).map((photo, pIdx) => (
                          <HistoryPhotoThumb
                            key={photo.id || `${photo.name}-${pIdx}`}
                            photo={photo}
                          />
                        ))}
                        {allPhotos.length > 7 && (
                          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-dashed border-[#cbd5e1] bg-[#eef2f7] text-[11px] font-bold text-[#64748b] dark:border-[#334155] dark:bg-[#1a2332] dark:text-[#94a3b8]">
                            +{allPhotos.length - 7}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => {
                  setLocalHistory([]);
                  localStorage.removeItem("duplicate_finder_history");
                  toast.info("History cleared");
                }}
                className="text-xs font-semibold text-red-500 hover:underline"
              >
                Clear All History
              </button>
              <button
                onClick={() => setShowHistory(false)}
                className="rounded-full bg-[#172033] px-5 py-2.5 text-xs font-bold text-white hover:bg-black dark:bg-[#202b3c] dark:hover:bg-[#2c3b52]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
