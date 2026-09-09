import { and, desc, eq, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { InsertUser, scanAssets, scanGroups, scans, users, User, Scan, ScanGroup, ScanAsset } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: any = null;
let _pool: mysql.Pool | null = null;

// Local in-memory / fallback store for when MySQL is not configured
const fallbackUsers: Map<string, User> = new Map();
let nextUserId = 1;

const fallbackScans: Map<number, { scan: Scan; groups: ScanGroup[]; assets: ScanAsset[] }> = new Map();
let nextScanId = 1;
let nextGroupId = 1;
let nextAssetId = 1;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = mysql.createPool({
        uri: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });
      _db = drizzle(_pool);
      console.log("[Database] Connected successfully to MySQL!");
    } catch (error) {
      console.warn("[Database] Failed to connect to MySQL:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (db) {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    for (const field of textFields) {
      if (user[field] !== undefined) {
        values[field] = user[field] ?? null;
        updateSet[field] = user[field] ?? null;
      }
    }
    values.lastSignedIn = user.lastSignedIn ?? new Date();
    updateSet.lastSignedIn = values.lastSignedIn;
    if (user.role !== undefined || user.openId === ENV.ownerOpenId) {
      values.role = user.role ?? "admin";
      updateSet.role = values.role;
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
    return;
  }

  // Fallback in-memory storage
  const now = new Date();
  const existing = fallbackUsers.get(user.openId);
  if (existing) {
    existing.name = user.name ?? existing.name;
    existing.email = user.email ?? existing.email;
    existing.loginMethod = user.loginMethod ?? existing.loginMethod;
    existing.lastSignedIn = user.lastSignedIn ?? now;
    existing.updatedAt = now;
    if (user.role) existing.role = user.role;
    fallbackUsers.set(user.openId, existing);
  } else {
    const newUser: User = {
      id: nextUserId++,
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? "local",
      role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user"),
      createdAt: now,
      updatedAt: now,
      lastSignedIn: user.lastSignedIn ?? now,
    };
    fallbackUsers.set(user.openId, newUser);
  }
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (db) {
    const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    return result[0];
  }
  return fallbackUsers.get(openId);
}

export async function getUserByEmailOrName(identifier: string): Promise<User | undefined> {
  const clean = identifier.trim();
  const db = await getDb();
  if (db) {
    const result = await db
      .select()
      .from(users)
      .where(or(eq(users.email, clean), eq(users.name, clean)))
      .limit(1);
    return result[0];
  }
  for (const user of Array.from(fallbackUsers.values())) {
    if (user.email === clean || user.name === clean) return user;
  }
  return undefined;
}

export type SaveScanInput = {
  name: string;
  fileCount: number;
  duplicateGroupCount: number;
  reclaimableBytes: number;
  threshold: number;
  groups: Array<{
    label: string;
    note: string;
    similarity: number;
    accent: "coral" | "blue" | "ink";
    assets: Array<{
      fileName: string;
      fileSize: number;
      width: number;
      height: number;
      sourceFolder?: string;
      duplicateType?: string;
      qualityScore: number;
      recommendation: "keep" | "remove" | "review";
      fingerprint?: number[];
      isKeeper: boolean;
    }>;
  }>;
};

export async function saveScan(userId: number, input: SaveScanInput) {
  const db = await getDb();
  if (db) {
    const result = await db.insert(scans).values({
      userId,
      name: input.name,
      fileCount: input.fileCount,
      duplicateGroupCount: input.duplicateGroupCount,
      reclaimableBytes: input.reclaimableBytes,
      threshold: input.threshold,
    });
    const scanId = Number(result[0].insertId);

    for (const group of input.groups) {
      const groupResult = await db.insert(scanGroups).values({
        scanId,
        label: group.label,
        note: group.note,
        similarity: group.similarity,
        accent: group.accent,
      });
      const groupId = Number(groupResult[0].insertId);
      if (group.assets.length) {
        await db.insert(scanAssets).values(group.assets.map((asset) => ({
          scanId,
          groupId,
          fileName: asset.fileName,
          fileSize: asset.fileSize,
          width: asset.width,
          height: asset.height,
          sourceFolder: asset.sourceFolder,
          duplicateType: asset.duplicateType,
          qualityScore: asset.qualityScore,
          recommendation: asset.recommendation,
          fingerprint: asset.fingerprint ? JSON.stringify(asset.fingerprint) : null,
          isKeeper: asset.isKeeper ? 1 : 0,
        })));
      }
    }
    return { scanId };
  }

  // Fallback in-memory storage
  const now = new Date();
  const scanId = nextScanId++;
  const scanRecord: Scan = {
    id: scanId,
    userId,
    name: input.name,
    fileCount: input.fileCount,
    duplicateGroupCount: input.duplicateGroupCount,
    reclaimableBytes: input.reclaimableBytes,
    threshold: input.threshold,
    createdAt: now,
    updatedAt: now,
  };

  const savedGroups: ScanGroup[] = [];
  const savedAssets: ScanAsset[] = [];

  for (const group of input.groups) {
    const groupId = nextGroupId++;
    const groupRecord: ScanGroup = {
      id: groupId,
      scanId,
      label: group.label,
      note: group.note,
      similarity: group.similarity,
      accent: group.accent,
    };
    savedGroups.push(groupRecord);

    for (const asset of group.assets) {
      const assetRecord: ScanAsset = {
        id: nextAssetId++,
        scanId,
        groupId,
        fileName: asset.fileName,
        fileSize: asset.fileSize,
        width: asset.width,
        height: asset.height,
        sourceFolder: asset.sourceFolder ?? null,
        duplicateType: asset.duplicateType ?? null,
        qualityScore: asset.qualityScore,
        recommendation: asset.recommendation,
        fingerprint: asset.fingerprint ? JSON.stringify(asset.fingerprint) : null,
        isKeeper: asset.isKeeper ? 1 : 0,
      };
      savedAssets.push(assetRecord);
    }
  }

  fallbackScans.set(scanId, {
    scan: scanRecord,
    groups: savedGroups,
    assets: savedAssets,
  });

  return { scanId };
}

export async function listScansForUser(userId: number) {
  const db = await getDb();
  if (db) {
    return db.select().from(scans).where(eq(scans.userId, userId)).orderBy(desc(scans.createdAt));
  }
  const userScans: Scan[] = [];
  for (const entry of Array.from(fallbackScans.values())) {
    if (entry.scan.userId === userId) {
      userScans.push(entry.scan);
    }
  }
  return userScans.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getScanForUser(userId: number, scanId: number) {
  const db = await getDb();
  if (db) {
    const scan = (await db.select().from(scans).where(and(eq(scans.id, scanId), eq(scans.userId, userId))).limit(1))[0];
    if (!scan) return null;
    const groups = await db.select().from(scanGroups).where(eq(scanGroups.scanId, scanId));
    const assets = await db.select().from(scanAssets).where(eq(scanAssets.scanId, scanId));
    return { scan, groups, assets };
  }

  const entry = fallbackScans.get(scanId);
  if (!entry || entry.scan.userId !== userId) return null;
  return entry;
}
