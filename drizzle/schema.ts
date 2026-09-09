import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const scans = mysqlTable("scans", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  fileCount: int("fileCount").notNull().default(0),
  duplicateGroupCount: int("duplicateGroupCount").notNull().default(0),
  reclaimableBytes: int("reclaimableBytes").notNull().default(0),
  threshold: int("threshold").notNull().default(10),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const scanGroups = mysqlTable("scanGroups", {
  id: int("id").autoincrement().primaryKey(),
  scanId: int("scanId").notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  note: text("note").notNull(),
  similarity: int("similarity").notNull(),
  accent: mysqlEnum("accent", ["coral", "blue", "ink"]).notNull().default("blue"),
});

export const scanAssets = mysqlTable("scanAssets", {
  id: int("id").autoincrement().primaryKey(),
  scanId: int("scanId").notNull(),
  groupId: int("groupId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileSize: int("fileSize").notNull().default(0),
  width: int("width").notNull().default(0),
  height: int("height").notNull().default(0),
  sourceFolder: varchar("sourceFolder", { length: 255 }),
  duplicateType: varchar("duplicateType", { length: 80 }),
  qualityScore: int("qualityScore").notNull().default(0),
  recommendation: mysqlEnum("recommendation", ["keep", "remove", "review"]).notNull().default("review"),
  fingerprint: text("fingerprint"),
  isKeeper: int("isKeeper").notNull().default(0),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Scan = typeof scans.$inferSelect;
export type InsertScan = typeof scans.$inferInsert;
export type ScanGroup = typeof scanGroups.$inferSelect;
export type ScanAsset = typeof scanAssets.$inferSelect;
