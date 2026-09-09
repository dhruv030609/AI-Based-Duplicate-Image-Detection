export type SampleAsset = {
  name: string;
  width: number;
  height: number;
  size: number;
  sourceFolder: string;
  duplicateType: string;
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
};

export type SampleClusterDef = {
  idSuffix: string;
  label: string;
  note: string;
  accent: "coral" | "blue" | "ink";
  category: "vacation" | "urban" | "portrait" | "nature";
  assets: SampleAsset[];
};

export const SAMPLE_CLUSTERS_DATA: SampleClusterDef[] = [
  {
    idSuffix: "sunset",
    label: "Mountain Sunset (Golden Hour)",
    note: "3 variants found across Camera, WhatsApp and Downloads",
    accent: "coral",
    category: "vacation",
    assets: [
      {
        name: "IMG_2026_Sunset_HQ.jpg",
        width: 3840,
        height: 2160,
        size: 5120000,
        sourceFolder: "Camera",
        duplicateType: "Camera Original (4K RAW)",
        draw: (ctx, w, h) => {
          // Sky gradient
          const sky = ctx.createLinearGradient(0, 0, 0, h * 0.7);
          sky.addColorStop(0, "#1a1c4b");
          sky.addColorStop(0.35, "#7b2cbf");
          sky.addColorStop(0.65, "#f72585");
          sky.addColorStop(0.85, "#ff9e00");
          sky.addColorStop(1, "#ffe49e");
          ctx.fillStyle = sky;
          ctx.fillRect(0, 0, w, h);

          // Glowing Sun
          const sunGrad = ctx.createRadialGradient(w * 0.5, h * 0.58, 5, w * 0.5, h * 0.58, w * 0.22);
          sunGrad.addColorStop(0, "#ffffff");
          sunGrad.addColorStop(0.2, "#fff275");
          sunGrad.addColorStop(0.6, "rgba(255, 122, 0, 0.6)");
          sunGrad.addColorStop(1, "rgba(255, 0, 110, 0)");
          ctx.fillStyle = sunGrad;
          ctx.beginPath();
          ctx.arc(w * 0.5, h * 0.58, w * 0.22, 0, Math.PI * 2);
          ctx.fill();

          // Mountain Layer 1 (Back)
          ctx.fillStyle = "#3d0066";
          ctx.beginPath();
          ctx.moveTo(0, h * 0.65);
          ctx.lineTo(w * 0.25, h * 0.42);
          ctx.lineTo(w * 0.55, h * 0.62);
          ctx.lineTo(w * 0.75, h * 0.45);
          ctx.lineTo(w, h * 0.68);
          ctx.lineTo(w, h);
          ctx.lineTo(0, h);
          ctx.fill();

          // Mountain Layer 2 (Front)
          ctx.fillStyle = "#1b002c";
          ctx.beginPath();
          ctx.moveTo(0, h * 0.78);
          ctx.lineTo(w * 0.35, h * 0.55);
          ctx.lineTo(w * 0.65, h * 0.75);
          ctx.lineTo(w * 0.88, h * 0.58);
          ctx.lineTo(w, h * 0.72);
          ctx.lineTo(w, h);
          ctx.lineTo(0, h);
          ctx.fill();

          // Lake reflection
          const water = ctx.createLinearGradient(0, h * 0.8, 0, h);
          water.addColorStop(0, "#120024");
          water.addColorStop(1, "#ff6b6b");
          ctx.fillStyle = water;
          ctx.fillRect(0, h * 0.82, w, h * 0.18);
        },
      },
      {
        name: "IMG_2026_Sunset_WA0023.jpg",
        width: 1280,
        height: 720,
        size: 340000,
        sourceFolder: "WhatsApp",
        duplicateType: "WhatsApp Compressed (720p)",
        draw: (ctx, w, h) => {
          const sky = ctx.createLinearGradient(0, 0, 0, h * 0.7);
          sky.addColorStop(0, "#191b48");
          sky.addColorStop(0.35, "#752ab6");
          sky.addColorStop(0.65, "#ea247e");
          sky.addColorStop(0.85, "#f59700");
          sky.addColorStop(1, "#f8dc94");
          ctx.fillStyle = sky;
          ctx.fillRect(0, 0, w, h);

          const sunGrad = ctx.createRadialGradient(w * 0.5, h * 0.58, 5, w * 0.5, h * 0.58, w * 0.22);
          sunGrad.addColorStop(0, "#fcfcfc");
          sunGrad.addColorStop(0.2, "#f4e96d");
          sunGrad.addColorStop(0.6, "rgba(240, 115, 0, 0.55)");
          sunGrad.addColorStop(1, "rgba(240, 0, 100, 0)");
          ctx.fillStyle = sunGrad;
          ctx.beginPath();
          ctx.arc(w * 0.5, h * 0.58, w * 0.22, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#38005e";
          ctx.beginPath();
          ctx.moveTo(0, h * 0.65);
          ctx.lineTo(w * 0.25, h * 0.42);
          ctx.lineTo(w * 0.55, h * 0.62);
          ctx.lineTo(w * 0.75, h * 0.45);
          ctx.lineTo(w, h * 0.68);
          ctx.lineTo(w, h);
          ctx.lineTo(0, h);
          ctx.fill();

          ctx.fillStyle = "#180027";
          ctx.beginPath();
          ctx.moveTo(0, h * 0.78);
          ctx.lineTo(w * 0.35, h * 0.55);
          ctx.lineTo(w * 0.65, h * 0.75);
          ctx.lineTo(w * 0.88, h * 0.58);
          ctx.lineTo(w, h * 0.72);
          ctx.lineTo(w, h);
          ctx.lineTo(0, h);
          ctx.fill();
        },
      },
      {
        name: "Sunset_Cropped_Square.png",
        width: 1080,
        height: 1080,
        size: 920000,
        sourceFolder: "Downloads",
        duplicateType: "Cropped Instagram Square",
        draw: (ctx, w, h) => {
          const sky = ctx.createLinearGradient(0, 0, 0, h * 0.8);
          sky.addColorStop(0, "#241e5e");
          sky.addColorStop(0.4, "#8a32d4");
          sky.addColorStop(0.7, "#ff3399");
          sky.addColorStop(1, "#ffa71a");
          ctx.fillStyle = sky;
          ctx.fillRect(0, 0, w, h);

          const sunGrad = ctx.createRadialGradient(w * 0.5, h * 0.5, 8, w * 0.5, h * 0.5, w * 0.3);
          sunGrad.addColorStop(0, "#ffffff");
          sunGrad.addColorStop(0.3, "#fff588");
          sunGrad.addColorStop(1, "rgba(255, 50, 100, 0)");
          ctx.fillStyle = sunGrad;
          ctx.beginPath();
          ctx.arc(w * 0.5, h * 0.5, w * 0.3, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#220038";
          ctx.beginPath();
          ctx.moveTo(0, h * 0.7);
          ctx.lineTo(w * 0.45, h * 0.45);
          ctx.lineTo(w * 0.8, h * 0.68);
          ctx.lineTo(w, h * 0.6);
          ctx.lineTo(w, h);
          ctx.lineTo(0, h);
          ctx.fill();
        },
      },
    ],
  },
  {
    idSuffix: "architecture",
    label: "Urban Architecture & Skyline",
    note: "High-res original vs color-graded edit vs low-res webp thumbnail",
    accent: "blue",
    category: "urban",
    assets: [
      {
        name: "DSC_8842_Architecture.jpg",
        width: 4096,
        height: 2732,
        size: 6840000,
        sourceFolder: "Camera",
        duplicateType: "Master Camera Original (4K)",
        draw: (ctx, w, h) => {
          const sky = ctx.createLinearGradient(0, 0, 0, h);
          sky.addColorStop(0, "#0a1931");
          sky.addColorStop(0.5, "#15305b");
          sky.addColorStop(1, "#28588f");
          ctx.fillStyle = sky;
          ctx.fillRect(0, 0, w, h);

          const buildingColors = ["#0e1526", "#141e33", "#1a2640", "#0b101c"];
          for (let i = 0; i < 14; i++) {
            const bx = (w / 14) * i + (i % 3) * 6;
            const bw = w / 12;
            const bh = h * (0.35 + ((i * 17) % 35) / 100);
            ctx.fillStyle = buildingColors[i % buildingColors.length];
            ctx.fillRect(bx, h - bh, bw, bh);

            ctx.fillStyle = i % 2 === 0 ? "#fcd34d" : "#93c5fd";
            for (let wy = h - bh + 15; wy < h - 20; wy += 22) {
              for (let wx = bx + 6; wx < bx + bw - 8; wx += 14) {
                if ((wx + wy) % 7 !== 0) {
                  ctx.fillRect(wx, wy, 6, 9);
                }
              }
            }
          }
        },
      },
      {
        name: "DSC_8842_Vibrant_Grade.jpg",
        width: 4096,
        height: 2732,
        size: 6420000,
        sourceFolder: "Downloads",
        duplicateType: "Color Graded (Cyberpunk tone)",
        draw: (ctx, w, h) => {
          const sky = ctx.createLinearGradient(0, 0, 0, h);
          sky.addColorStop(0, "#080620");
          sky.addColorStop(0.5, "#2b0938");
          sky.addColorStop(1, "#691551");
          ctx.fillStyle = sky;
          ctx.fillRect(0, 0, w, h);

          const buildingColors = ["#0a0518", "#120924", "#1a0f30", "#080312"];
          for (let i = 0; i < 14; i++) {
            const bx = (w / 14) * i + (i % 3) * 6;
            const bw = w / 12;
            const bh = h * (0.35 + ((i * 17) % 35) / 100);
            ctx.fillStyle = buildingColors[i % buildingColors.length];
            ctx.fillRect(bx, h - bh, bw, bh);

            ctx.fillStyle = i % 2 === 0 ? "#ff007f" : "#00f0ff";
            for (let wy = h - bh + 15; wy < h - 20; wy += 22) {
              for (let wx = bx + 6; wx < bx + bw - 8; wx += 14) {
                if ((wx + wy) % 7 !== 0) {
                  ctx.fillRect(wx, wy, 6, 9);
                }
              }
            }
          }
        },
      },
      {
        name: "DSC_8842_thumb.webp",
        width: 640,
        height: 427,
        size: 52000,
        sourceFolder: "Downloads",
        duplicateType: "Compressed WebP Thumbnail",
        draw: (ctx, w, h) => {
          const sky = ctx.createLinearGradient(0, 0, 0, h);
          sky.addColorStop(0, "#0d1b33");
          sky.addColorStop(0.5, "#18335e");
          sky.addColorStop(1, "#2c5c94");
          ctx.fillStyle = sky;
          ctx.fillRect(0, 0, w, h);

          const buildingColors = ["#101728", "#162035", "#1c2842", "#0c111e"];
          for (let i = 0; i < 14; i++) {
            const bx = (w / 14) * i;
            const bw = w / 12;
            const bh = h * (0.35 + ((i * 17) % 35) / 100);
            ctx.fillStyle = buildingColors[i % buildingColors.length];
            ctx.fillRect(bx, h - bh, bw, bh);
          }
        },
      },
    ],
  },
  {
    idSuffix: "portrait",
    label: "Studio Portrait Session",
    note: "Full resolution uncompressed vs Social media export vs Duplicate clone",
    accent: "ink",
    category: "portrait",
    assets: [
      {
        name: "Portrait_Studio_RAW.png",
        width: 3200,
        height: 4000,
        size: 9450000,
        sourceFolder: "Camera",
        duplicateType: "Master Camera Original (Lossless)",
        draw: (ctx, w, h) => {
          const bg = ctx.createRadialGradient(w * 0.5, h * 0.45, 10, w * 0.5, h * 0.45, w * 0.8);
          bg.addColorStop(0, "#f3e8dc");
          bg.addColorStop(0.6, "#d8c4b0");
          bg.addColorStop(1, "#8e7862");
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, w, h);

          ctx.fillStyle = "#2c241c";
          ctx.beginPath();
          ctx.ellipse(w * 0.5, h * 0.38, w * 0.18, h * 0.18, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(w * 0.5, h * 0.78, w * 0.42, h * 0.3, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = "rgba(255, 235, 200, 0.6)";
          ctx.lineWidth = 14;
          ctx.beginPath();
          ctx.arc(w * 0.5, h * 0.38, w * 0.18, Math.PI * 1.1, Math.PI * 1.8);
          ctx.stroke();
        },
      },
      {
        name: "Portrait_Studio_RAW (1).png",
        width: 3200,
        height: 4000,
        size: 9450000,
        sourceFolder: "Camera",
        duplicateType: "Exact File Copy (Accidental Duplicate)",
        draw: (ctx, w, h) => {
          const bg = ctx.createRadialGradient(w * 0.5, h * 0.45, 10, w * 0.5, h * 0.45, w * 0.8);
          bg.addColorStop(0, "#f3e8dc");
          bg.addColorStop(0.6, "#d8c4b0");
          bg.addColorStop(1, "#8e7862");
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, w, h);

          ctx.fillStyle = "#2c241c";
          ctx.beginPath();
          ctx.ellipse(w * 0.5, h * 0.38, w * 0.18, h * 0.18, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(w * 0.5, h * 0.78, w * 0.42, h * 0.3, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = "rgba(255, 235, 200, 0.6)";
          ctx.lineWidth = 14;
          ctx.beginPath();
          ctx.arc(w * 0.5, h * 0.38, w * 0.18, Math.PI * 1.1, Math.PI * 1.8);
          ctx.stroke();
        },
      },
      {
        name: "Portrait_Social_Export.jpg",
        width: 1080,
        height: 1350,
        size: 460000,
        sourceFolder: "Downloads",
        duplicateType: "Compressed Social Export (1080p)",
        draw: (ctx, w, h) => {
          const bg = ctx.createRadialGradient(w * 0.5, h * 0.45, 10, w * 0.5, h * 0.45, w * 0.8);
          bg.addColorStop(0, "#eddccb");
          bg.addColorStop(0.6, "#ceb7a0");
          bg.addColorStop(1, "#836c56");
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, w, h);

          ctx.fillStyle = "#2a221a";
          ctx.beginPath();
          ctx.ellipse(w * 0.5, h * 0.38, w * 0.18, h * 0.18, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(w * 0.5, h * 0.78, w * 0.42, h * 0.3, 0, 0, Math.PI * 2);
          ctx.fill();
        },
      },
    ],
  },
  {
    idSuffix: "nature",
    label: "Coastal Beach & Emerald Waves",
    note: "4K Drone aerial vs WhatsApp transmission vs Desktop Wallpaper resize",
    accent: "coral",
    category: "nature",
    assets: [
      {
        name: "DJI_0492_Coastline_4K.jpg",
        width: 3840,
        height: 2160,
        size: 7850000,
        sourceFolder: "Camera",
        duplicateType: "Camera Original (4K Drone)",
        draw: (ctx, w, h) => {
          // Ocean gradient
          const ocean = ctx.createLinearGradient(0, 0, 0, h);
          ocean.addColorStop(0, "#083344");
          ocean.addColorStop(0.3, "#0e7490");
          ocean.addColorStop(0.65, "#06b6d4");
          ocean.addColorStop(0.85, "#a5f3fc");
          ocean.addColorStop(1, "#fde68a"); // sand
          ctx.fillStyle = ocean;
          ctx.fillRect(0, 0, w, h);

          // White foam waves
          ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
          ctx.lineWidth = 12;
          ctx.beginPath();
          ctx.arc(w * 0.4, h * 0.7, w * 0.5, 0, Math.PI * 0.6);
          ctx.stroke();

          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.arc(w * 0.45, h * 0.78, w * 0.45, 0, Math.PI * 0.6);
          ctx.stroke();
        },
      },
      {
        name: "DJI_0492_Coastline_WA.jpg",
        width: 1280,
        height: 720,
        size: 380000,
        sourceFolder: "WhatsApp",
        duplicateType: "WhatsApp Compressed (720p)",
        draw: (ctx, w, h) => {
          const ocean = ctx.createLinearGradient(0, 0, 0, h);
          ocean.addColorStop(0, "#092f3f");
          ocean.addColorStop(0.3, "#0f6c86");
          ocean.addColorStop(0.65, "#08a8c4");
          ocean.addColorStop(0.85, "#9debf4");
          ocean.addColorStop(1, "#f6df84");
          ctx.fillStyle = ocean;
          ctx.fillRect(0, 0, w, h);

          ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.arc(w * 0.4, h * 0.7, w * 0.5, 0, Math.PI * 0.6);
          ctx.stroke();
        },
      },
      {
        name: "Coastline_Wallpaper_1080p.png",
        width: 1920,
        height: 1080,
        size: 2100000,
        sourceFolder: "Downloads",
        duplicateType: "Resized Wallpaper (1080p)",
        draw: (ctx, w, h) => {
          const ocean = ctx.createLinearGradient(0, 0, 0, h);
          ocean.addColorStop(0, "#062836");
          ocean.addColorStop(0.3, "#0d6a84");
          ocean.addColorStop(0.65, "#07acc7");
          ocean.addColorStop(0.85, "#a0f0f9");
          ocean.addColorStop(1, "#fbe186");
          ctx.fillStyle = ocean;
          ctx.fillRect(0, 0, w, h);

          ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
          ctx.lineWidth = 11;
          ctx.beginPath();
          ctx.arc(w * 0.4, h * 0.7, w * 0.5, 0, Math.PI * 0.6);
          ctx.stroke();
        },
      },
    ],
  },
];

export async function generateSampleClusters(preset: "all" | "vacation" | "urban" | "portrait" | "nature" = "all"): Promise<any[]> {
  const clusters: any[] = [];
  const selectedDefs =
    preset === "all"
      ? SAMPLE_CLUSTERS_DATA
      : SAMPLE_CLUSTERS_DATA.filter((d) => d.category === preset);

  for (let cIdx = 0; cIdx < selectedDefs.length; cIdx++) {
    const group = selectedDefs[cIdx];
    const generatedAssets: any[] = [];

    for (let aIdx = 0; aIdx < group.assets.length; aIdx++) {
      const assetDef = group.assets[aIdx];
      const canvas = document.createElement("canvas");
      canvas.width = 480;
      canvas.height = Math.round((480 * assetDef.height) / assetDef.width);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        assetDef.draw(ctx, canvas.width, canvas.height);
      }
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

      // Compute perceptual hash
      const thumbCanvas = document.createElement("canvas");
      thumbCanvas.width = 8;
      thumbCanvas.height = 8;
      const tCtx = thumbCanvas.getContext("2d", { willReadFrequently: true });
      const signature: number[] = [];
      if (tCtx) {
        tCtx.drawImage(canvas, 0, 0, 8, 8);
        const p = tCtx.getImageData(0, 0, 8, 8).data;
        for (let i = 0; i < p.length; i += 4) {
          signature.push(Math.round(p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114));
        }
      }

      generatedAssets.push({
        id: `sample-asset-${group.idSuffix}-${aIdx}-${Date.now()}`,
        name: assetDef.name,
        size: assetDef.size,
        src: dataUrl,
        width: assetDef.width,
        height: assetDef.height,
        signature,
        sourceFolder: assetDef.sourceFolder,
        duplicateType: assetDef.duplicateType,
        qualityScore: Math.round(
          Math.min(100, (assetDef.width * assetDef.height) / 18000 + assetDef.size / 120000)
        ),
        recommendation: aIdx === 0 ? "keep" : "remove",
      });
    }

    const similarity =
      group.idSuffix === "portrait"
        ? 100
        : group.idSuffix === "sunset"
        ? 95
        : group.idSuffix === "nature"
        ? 93
        : 90;

    clusters.push({
      id: `sample-cluster-${group.idSuffix}-${Date.now()}`,
      label: group.label,
      note: group.note,
      similarity,
      accent: group.accent,
      assets: generatedAssets,
    });
  }

  return clusters;
}
