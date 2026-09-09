export const ENV = {
  appId: process.env.VITE_APP_ID || "duplicate-image-finder-app",
  cookieSecret: process.env.JWT_SECRET || "duplicate-image-finder-secret-jwt-key-2026-fallback-string-32-chars-long",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
