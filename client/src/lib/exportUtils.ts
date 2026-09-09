import JSZip from "jszip";
import { toast } from "sonner";

export type ExportAsset = {
  id: string;
  name: string;
  size: number;
  src: string;
  width: number;
  height: number;
  sourceFolder?: string;
  duplicateType?: string;
  qualityScore?: number;
  recommendation?: "keep" | "remove" | "review";
};

export type ExportCluster = {
  id: string;
  label: string;
  note: string;
  similarity: number;
  accent: "coral" | "blue" | "ink";
  assets: ExportAsset[];
};

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  toast.success(`Downloaded ${filename}`);
}

export function generatePowershellScript(
  unwanted: ExportAsset[],
  keepers: ExportAsset[],
  formatBytes: (b: number) => string
): string {
  const totalReclaim = unwanted.reduce((sum, a) => sum + a.size, 0);
  const lines = unwanted.map(
    (asset) =>
      `Remove-Item -LiteralPath "${(asset.sourceFolder || "Images")}\\${asset.name}" -Force -ErrorAction SilentlyContinue`
  );

  return [
    "# =====================================================================",
    "# Duplicate Image Finder — Windows PowerShell Automated Cleanup Script",
    `# Generated: ${new Date().toLocaleString()}`,
    `# Target Duplicates: ${unwanted.length} files`,
    `# Estimated Storage Reclaim: ${formatBytes(totalReclaim)}`,
    "# =====================================================================",
    "",
    "$ErrorActionPreference = 'Continue'",
    "Write-Host '==================================================' -ForegroundColor Cyan",
    "Write-Host '   Duplicate Image Finder — Cleanup Runner' -ForegroundColor Cyan",
    "Write-Host '==================================================' -ForegroundColor Cyan",
    `Write-Host 'Duplicates to remove: ${unwanted.length}' -ForegroundColor Yellow`,
    `Write-Host 'Reclaimable Space:   ${formatBytes(totalReclaim)}' -ForegroundColor Green`,
    "",
    "$confirmation = Read-Host 'Do you want to proceed with deleting duplicate files? (y/N)'",
    "if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {",
    "    Write-Host 'Cleanup cancelled by user.' -ForegroundColor Yellow",
    "    exit",
    "}",
    "",
    "Write-Host 'Deleting duplicates...' -ForegroundColor Cyan",
    "$deletedCount = 0",
    ...lines.map((l) => `${l}\n$deletedCount++`),
    "",
    "Write-Host '==================================================' -ForegroundColor Green",
    `Write-Host 'Successfully removed duplicate files!' -ForegroundColor Green`,
    `Write-Host 'Reclaimed: ${formatBytes(totalReclaim)}' -ForegroundColor Green`,
    "Write-Host '==================================================' -ForegroundColor Green",
    "",
  ].join("\r\n");
}

export function generateBatchScript(
  unwanted: ExportAsset[],
  formatBytes: (b: number) => string
): string {
  const totalReclaim = unwanted.reduce((sum, a) => sum + a.size, 0);
  const lines = unwanted.map(
    (asset) => `del /f /q "${(asset.sourceFolder || "Images")}\\${asset.name}"`
  );

  return [
    "@echo off",
    "rem ===================================================================",
    "rem Duplicate Image Finder - Windows Batch Cleanup Script",
    `rem Generated: ${new Date().toLocaleString()}`,
    `rem Duplicates: ${unwanted.length} (${formatBytes(totalReclaim)} reclaimable)`,
    "rem ===================================================================",
    "",
    "echo ==================================================",
    "echo   Duplicate Image Finder - Batch Cleanup",
    "echo ==================================================",
    `echo Duplicates to remove: ${unwanted.length}`,
    `echo Reclaimable space:   ${formatBytes(totalReclaim)}`,
    "echo.",
    "set /p CONFIRM=Do you want to permanently delete duplicates? (y/N): ",
    'if /i not "%CONFIRM%"=="y" (',
    "    echo Cleanup cancelled.",
    "    pause",
    "    exit /b",
    ")",
    "",
    "echo Removing duplicates...",
    ...lines,
    "echo.",
    "echo Cleanup completed successfully!",
    "pause",
  ].join("\r\n");
}

export function generateBashScript(
  unwanted: ExportAsset[],
  formatBytes: (b: number) => string
): string {
  const totalReclaim = unwanted.reduce((sum, a) => sum + a.size, 0);
  const lines = unwanted.map(
    (asset) => `rm -f -- "${(asset.sourceFolder || "Images")}/${asset.name}"`
  );

  return [
    "#!/usr/bin/env bash",
    "# =====================================================================",
    "# Duplicate Image Finder — Linux/macOS Shell Cleanup Script",
    `# Generated: ${new Date().toLocaleString()}`,
    `# Target Duplicates: ${unwanted.length} files (${formatBytes(totalReclaim)})`,
    "# =====================================================================",
    "set -euo pipefail",
    "",
    "echo -e '\\033[1;36m==================================================\\033[0m'",
    "echo -e '\\033[1;36m   Duplicate Image Finder — Cleanup Runner        \\033[0m'",
    "echo -e '\\033[1;36m==================================================\\033[0m'",
    `echo -e '\\033[1;33mDuplicates to remove: ${unwanted.length}\\033[0m'`,
    `echo -e '\\033[1;32mReclaimable Space:   ${formatBytes(totalReclaim)}\\033[0m'`,
    "",
    "read -rp 'Do you want to proceed with removing duplicates? [y/N]: ' confirm",
    'if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then',
    "    echo 'Cleanup cancelled.'",
    "    exit 0",
    "fi",
    "",
    "echo 'Removing duplicates...'",
    ...lines,
    "",
    "echo -e '\\033[1;32mCleanup completed successfully!\\033[0m'",
  ].join("\n");
}

export function generatePythonScript(
  unwanted: ExportAsset[],
  keepers: ExportAsset[],
  formatBytes: (b: number) => string
): string {
  const totalReclaim = unwanted.reduce((sum, a) => sum + a.size, 0);
  const paths = unwanted.map((a) => `${a.sourceFolder || "Images"}/${a.name}`);

  return `#!/usr/bin/env python3
"""
Duplicate Image Finder — Cross-Platform Python Cleanup Utility
Generated: ${new Date().toLocaleString()}
Target Duplicates: ${unwanted.length} files (${formatBytes(totalReclaim)})
"""

import os
import sys
import shutil
import argparse
from pathlib import Path

DUPLICATE_FILES = ${JSON.stringify(paths, null, 4)}

def main():
    parser = argparse.ArgumentParser(description="Clean up or quarantine duplicate image files.")
    parser.add_argument("--quarantine", "-q", help="Move duplicates to a quarantine folder instead of deleting", default=None)
    parser.add_argument("--force", "-f", action="store_true", help="Delete without interactive confirmation")
    parser.add_argument("--dry-run", "-d", action="store_true", help="List actions without making changes")
    args = parser.parse_args()

    print("=" * 55)
    print("   Duplicate Image Finder — Python Cleanup Runner")
    print("=" * 55)
    print(f"Total duplicate files : {len(DUPLICATE_FILES)}")
    print(f"Reclaimable space     : ${formatBytes(totalReclaim)}")
    print("=" * 55)

    if args.dry_run:
        print("[DRY RUN MODE] The following files would be affected:")
        for path in DUPLICATE_FILES:
            print(f"  - {path}")
        return

    if not args.force:
        action = f"move to '{args.quarantine}'" if args.quarantine else "permanently DELETE"
        resp = input(f"Do you want to {action} {len(DUPLICATE_FILES)} files? (y/N): ").strip().lower()
        if resp != "y":
            print("Operation cancelled.")
            return

    if args.quarantine:
        qdir = Path(args.quarantine)
        qdir.mkdir(parents=True, exist_ok=True)
        print(f"Quarantining duplicates to {qdir.resolve()}...")
        for rel_path in DUPLICATE_FILES:
            p = Path(rel_path)
            if p.exists():
                dest = qdir / p.name
                shutil.move(str(p), str(dest))
                print(f"[MOVED] {p.name} -> {dest}")
            else:
                print(f"[NOT FOUND] {rel_path}")
    else:
        print("Deleting duplicates...")
        for rel_path in DUPLICATE_FILES:
            p = Path(rel_path)
            if p.exists():
                try:
                    p.unlink()
                    print(f"[DELETED] {rel_path}")
                except Exception as e:
                    print(f"[ERROR] Could not delete {rel_path}: {e}")
            else:
                print(f"[NOT FOUND] {rel_path}")

    print("=" * 55)
    print("Cleanup process finished!")

if __name__ == "__main__":
    main()
`;
}

export function generateHtmlAuditReport(
  clusters: ExportCluster[],
  keepMap: Record<string, string>,
  formatBytes: (b: number) => string
): string {
  const totalFiles = clusters.reduce((s, c) => s + c.assets.length, 0);
  const totalReclaim = clusters.reduce((sum, c) => {
    const keeper = keepMap[c.id] ?? c.assets.find((a) => a.recommendation === "keep")?.id ?? c.assets[0]?.id;
    return sum + c.assets.reduce((csum, a) => csum + (a.id === keeper ? 0 : a.size), 0);
  }, 0);

  const clusterRows = clusters
    .map((cluster, idx) => {
      const keeper = keepMap[cluster.id] ?? cluster.assets.find((a) => a.recommendation === "keep")?.id ?? cluster.assets[0]?.id;
      const assetCards = cluster.assets
        .map((asset) => {
          const isKeeper = asset.id === keeper;
          return `
          <div class="asset-card ${isKeeper ? "keeper-card" : "duplicate-card"}">
            <div class="thumbnail-wrapper">
              <img src="${asset.src}" alt="${asset.name}" class="thumbnail" />
              <span class="badge ${isKeeper ? "badge-keep" : "badge-remove"}">
                ${isKeeper ? "✓ PRESERVED KEEPER" : "✕ REMOVE DUPLICATE"}
              </span>
            </div>
            <div class="asset-info">
              <p class="asset-name" title="${asset.name}">${asset.name}</p>
              <div class="asset-meta">
                <span>📁 ${asset.sourceFolder || "Images"}</span>
                <span>📐 ${asset.width} × ${asset.height}</span>
                <span>💾 ${formatBytes(asset.size)}</span>
                <span>⭐ Quality ${asset.qualityScore ?? 85}/100</span>
              </div>
              <span class="type-tag">${asset.duplicateType || (isKeeper ? "Original" : "Duplicate")}</span>
            </div>
          </div>`;
        })
        .join("");

      return `
      <section class="cluster-section">
        <div class="cluster-header">
          <div class="cluster-title">
            <span class="cluster-number">#${String(idx + 1).padStart(2, "0")}</span>
            <div>
              <h3>${cluster.label}</h3>
              <p class="cluster-note">${cluster.note}</p>
            </div>
          </div>
          <div class="cluster-badge">
            <span class="match-badge">${cluster.similarity}% Visual Match</span>
          </div>
        </div>
        <div class="assets-grid">
          ${assetCards}
        </div>
      </section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Duplicate Image Finder — Visual Audit Report</title>
  <style>
    :root {
      --primary: #1957d2;
      --success: #27764d;
      --danger: #c7472e;
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text: #172033;
      --text-muted: #64748b;
      --border: #e2e8f0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 32px 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 32px;
      margin-bottom: 32px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.03);
    }
    .header h1 { font-size: 28px; font-weight: 800; color: var(--text); }
    .header p { color: var(--text-muted); font-size: 14px; margin-top: 4px; }
    .stats-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
    }
    .stat-card {
      background: #f1f5f9;
      padding: 16px;
      border-radius: 14px;
    }
    .stat-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); }
    .stat-value { font-size: 24px; font-weight: 800; color: var(--text); margin-top: 4px; }
    .stat-value.highlight { color: var(--primary); }
    .stat-value.success { color: var(--success); }
    .cluster-section {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 24px;
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    .cluster-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
    }
    .cluster-title { display: flex; align-items: center; gap: 14px; }
    .cluster-number {
      background: var(--primary);
      color: white;
      font-size: 12px;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 8px;
    }
    .cluster-note { font-size: 13px; color: var(--text-muted); }
    .match-badge {
      background: #eef3ff;
      color: var(--primary);
      font-size: 11px;
      font-weight: 700;
      padding: 6px 12px;
      border-radius: 100px;
      border: 1px solid #c7d7fc;
    }
    .assets-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }
    .asset-card {
      border: 2px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
      background: var(--card-bg);
      transition: all 0.2s ease;
    }
    .asset-card.keeper-card {
      border-color: var(--success);
      box-shadow: 0 4px 14px rgba(39, 118, 77, 0.12);
    }
    .asset-card.duplicate-card {
      border-color: #fecaca;
    }
    .thumbnail-wrapper {
      position: relative;
      width: 100%;
      height: 180px;
      background: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .thumbnail {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .badge {
      position: absolute;
      top: 10px;
      left: 10px;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.08em;
      padding: 4px 8px;
      border-radius: 6px;
      text-transform: uppercase;
    }
    .badge-keep { background: #dcfce7; color: #166534; }
    .badge-remove { background: #fee2e2; color: #991b1b; }
    .asset-info { padding: 14px; }
    .asset-name { font-size: 13px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .asset-meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 8px;
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 8px;
    }
    .type-tag {
      display: inline-block;
      margin-top: 10px;
      font-size: 10px;
      font-weight: 700;
      background: #f1f5f9;
      padding: 2px 8px;
      border-radius: 4px;
      color: var(--text-muted);
    }
    .print-button {
      background: var(--primary);
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 100px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      margin-bottom: 20px;
    }
    @media print {
      body { background: white; padding: 0; }
      .print-button { display: none; }
      .header, .cluster-section { box-shadow: none; border-color: #ccc; }
    }
  </style>
</head>
<body>
  <div class="container">
    <button onclick="window.print()" class="print-button">🖨️ Print / Save as PDF</button>
    <div class="header">
      <h1>Duplicate Image Finder — Visual Audit Report</h1>
      <p>Report generated on ${new Date().toLocaleString()} · 100% Client-Side Privacy Clean</p>
      <div class="stats-bar">
        <div class="stat-card">
          <div class="stat-label">Total Images Scanned</div>
          <div class="stat-value">${totalFiles}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Duplicate Groups</div>
          <div class="stat-value highlight">${clusters.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Reclaimable Storage</div>
          <div class="stat-value success">${formatBytes(totalReclaim)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Duplicates to Remove</div>
          <div class="stat-value">${clusters.flatMap((c) => c.assets).length - clusters.length}</div>
        </div>
      </div>
    </div>

    ${clusterRows}
  </div>
</body>
</html>`;
}

export async function exportKeeperZipArchive(
  keepers: ExportAsset[],
  toastMsg = true
): Promise<void> {
  if (!keepers.length) {
    toast.error("No keepers selected to export");
    return;
  }
  if (toastMsg) toast.info("Packaging preserved photos into ZIP archive…");
  const zip = new JSZip();
  for (const asset of keepers) {
    try {
      const response = await fetch(asset.src);
      const blob = await response.blob();
      zip.file(`${asset.sourceFolder || "Camera"}/${asset.name}`, blob);
    } catch {
      zip.file(`${asset.sourceFolder || "Camera"}/${asset.name}.url.txt`, asset.src);
    }
  }
  const zipBlob = await zip.generateAsync({ type: "blob" });
  downloadBlob(zipBlob, "duplicate-keepers-curated.zip");
}

export async function exportDuplicatesZipArchive(
  unwanted: ExportAsset[],
  toastMsg = true
): Promise<void> {
  if (!unwanted.length) {
    toast.error("No duplicate files marked for removal");
    return;
  }
  if (toastMsg) toast.info("Creating backup archive of duplicate files…");
  const zip = new JSZip();
  for (const asset of unwanted) {
    try {
      const response = await fetch(asset.src);
      const blob = await response.blob();
      zip.file(`duplicates-quarantine/${asset.sourceFolder || "Duplicates"}/${asset.name}`, blob);
    } catch {
      zip.file(`duplicates-quarantine/${asset.sourceFolder || "Duplicates"}/${asset.name}.url.txt`, asset.src);
    }
  }
  const zipBlob = await zip.generateAsync({ type: "blob" });
  downloadBlob(zipBlob, "duplicates-backup-quarantine.zip");
}
