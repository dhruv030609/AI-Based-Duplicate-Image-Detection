# 📸 Duplicate Image Finder 

A modern, fast, and privacy-first web application to find, compare, and organize duplicate and similar photos directly in your browser.

---

## ✨ Features

- **⚡ Blazing Fast In-Browser Processing**: Calculates perceptual image hashes directly in the browser (50–100 images/sec) without uploading your private photos to external servers.
- **🔍 Smart Side-by-Side Comparison**: Compare two or more similar images with zoom, pan, difference slider, and metadata inspections.
- **📁 Multi-Format & ZIP Support**: Drag & drop individual images (`.jpg`, `.png`, `.webp`, `.bmp`, etc.), entire folders, or `.zip` archives.
- **💾 Scan History & Instant Restores**: Saves your previous scans with persistent thumbnail previews so you can restore and inspect duplicate groups anytime.
- **☁️ Cloud & Local Storage**: Save scans locally in browser storage or sign in to sync scan summaries across devices with MySQL & Drizzle ORM.
- **🧹 One-Click Cleanup & Export**:
  - Download Python 3 quarantine script (`.py`)
  - Linux / macOS Bash script (`.sh`)
  - Windows Batch script (`.bat`)
  - Spreadsheet CSV (`.csv`) / Text manifest (`.txt`)
  - Direct `.zip` backup archive
- **📊 Storage Analytics & Benchmark Tool**: Visual storage breakdown and performance test suite.


---

## 🚀 Quick Start Guide

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or higher)
- `npm` or `pnpm`

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
Open your browser and navigate to:
```
http://localhost:3000
```

---

## 🗄️ Database & Table Inspection

The project is pre-configured with a cloud MySQL database using **Drizzle ORM**.

### View & Edit Database Tables Visually
To open Drizzle Studio:
```bash
npx drizzle-kit studio
```
Then visit [https://local.drizzle.studio](https://local.drizzle.studio) to view all tables (`users`, `scans`, `scanGroups`, `scanAssets`).

### Push Schema Migrations
```bash
npm run db:push
```

---

## 📁 Project Structure

```
duplicate-image-finder/
├── client/                     # Frontend React + Vite application
│   ├── public/                 # Static assets and audio files
│   └── src/
│       ├── components/         # UI components & feature modals
│       │   ├── ui/             # Radix & Tailwind UI elements
│       │   ├── BenchmarkModal.tsx
│       │   ├── ClusterComparisonModal.tsx
│       │   ├── KeyboardShortcutsModal.tsx
│       │   └── StorageAnalyticsModal.tsx
│       ├── hooks/              # Custom React hooks (useAuth, useTheme, etc.)
│       ├── lib/                # Client utilities (exportUtils, sampleImages, soundEffects)
│       ├── pages/              # Application pages (Home.tsx, NotFound.tsx)
│       ├── App.tsx             # App root & context providers
│       ├── index.css           # Global design system & theme styles
│       └── main.tsx            # Frontend entry point
├── drizzle/                    # Database schemas & migrations
│   └── schema.ts               # MySQL schema definitions (users, scans, assets)
├── server/                     # Backend Express & tRPC server
│   ├── _core/                  # Server configuration, env, and helper core
│   ├── db.ts                   # Database connection & query helpers
│   └── routers.ts              # tRPC API routes & procedures
├── scripts/                    # Performance test & benchmark scripts
├── .env                        # Environment variables & database URL
├── drizzle.config.ts           # Drizzle Kit ORM configuration
├── package.json                # Dependencies and npm scripts
├── tsconfig.json               # TypeScript configuration
└── vite.config.ts              # Vite bundler configuration
```

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Lucide React, Framer Motion, JSZip
- **Backend**: Node.js, Express, tRPC v11
- **Database & ORM**: MySQL (Aiven Cloud), Drizzle ORM, Drizzle Kit
- **Image Processing**: Canvas 2D API, In-memory Perceptual Hashing (dHash/pHash)

---

## 📦 Production Build

To test and build the production bundle:
```bash
npm run build
npm start
```

---

## 📄 License
CODE cartel
>>>>>>> e5a2b81 (Initial commit: Duplicate Image Finder full-stack app with persistent history and comparison)
