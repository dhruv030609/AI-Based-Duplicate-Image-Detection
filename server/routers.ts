import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getScanForUser, getUserByEmailOrName, getUserByOpenId, listScansForUser, saveScan, upsertUser } from "./db";
import { sdk } from "./_core/sdk";

const assetInput = z.object({
  fileName: z.string().max(255),
  fileSize: z.number().int().nonnegative(),
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
  sourceFolder: z.string().max(255).optional(),
  duplicateType: z.string().max(80).optional(),
  qualityScore: z.number().int().min(0).max(100),
  recommendation: z.enum(["keep", "remove", "review"]),
  fingerprint: z.array(z.number().int().min(0).max(255)).max(64).optional(),
  isKeeper: z.boolean(),
});

const groupInput = z.object({
  label: z.string().max(255),
  note: z.string().max(1000),
  similarity: z.number().int().min(0).max(100),
  accent: z.enum(["coral", "blue", "ink"]),
  assets: z.array(assetInput).max(100),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    login: publicProcedure
      .input(
        z.object({
          emailOrName: z.string().min(1).max(120),
          role: z.enum(["user", "admin"]).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const identifier = input.emailOrName.trim();
        const existing = await getUserByEmailOrName(identifier);

        let openId = existing?.openId;
        const name = existing?.name || identifier.split("@")[0] || "User";
        const email = existing?.email || (identifier.includes("@") ? identifier : null);

        if (!existing) {
          openId = `user_${identifier.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now().toString(36)}`;
          await upsertUser({
            openId,
            name,
            email,
            loginMethod: "local",
            role: input.role || "user",
            lastSignedIn: new Date(),
          });
        } else {
          await upsertUser({
            openId: openId!,
            lastSignedIn: new Date(),
          });
        }

        const user = await getUserByOpenId(openId!);
        const sessionToken = await sdk.createSessionToken(openId!, {
          name,
          expiresInMs: ONE_YEAR_MS,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });
        return { success: true, user, token: sessionToken };
      }),
    register: publicProcedure
      .input(
        z.object({
          name: z.string().min(1).max(100),
          email: z.string().email(),
          role: z.enum(["user", "admin"]).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const cleanName = input.name.trim();
        const cleanEmail = input.email.trim();
        const existing = await getUserByEmailOrName(cleanEmail);

        const openId =
          existing?.openId ||
          `user_${cleanName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now().toString(36)}`;
        await upsertUser({
          openId,
          name: cleanName,
          email: cleanEmail,
          loginMethod: "local",
          role: input.role || (existing?.role ?? "user"),
          lastSignedIn: new Date(),
        });

        const user = await getUserByOpenId(openId);
        const sessionToken = await sdk.createSessionToken(openId, {
          name: cleanName,
          expiresInMs: ONE_YEAR_MS,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });
        return { success: true, user, token: sessionToken };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  scans: router({
    history: protectedProcedure.query(({ ctx }) => listScansForUser(ctx.user.id)),
    get: protectedProcedure.input(z.object({ scanId: z.number().int().positive() })).query(({ ctx, input }) => getScanForUser(ctx.user.id, input.scanId)),
    save: protectedProcedure.input(z.object({
      name: z.string().min(1).max(255),
      fileCount: z.number().int().nonnegative(),
      duplicateGroupCount: z.number().int().nonnegative(),
      reclaimableBytes: z.number().int().nonnegative(),
      threshold: z.number().int().min(4).max(64),
      groups: z.array(groupInput).max(200),
    })).mutation(({ ctx, input }) => saveScan(ctx.user.id, input)),
    aiSummary: protectedProcedure.input(z.object({
      label: z.string(),
      note: z.string(),
      similarity: z.number().int().min(0).max(100),
      files: z.array(z.object({ name: z.string(), size: z.number(), width: z.number(), height: z.number(), folder: z.string().optional() })).max(100),
    })).mutation(async ({ input }) => {
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You help organize duplicate photo groups. Give one concise sentence describing why these files likely belong together and one concise keeper recommendation. Do not claim to have viewed the actual pixels; only use the supplied metadata." },
          { role: "user", content: JSON.stringify(input) },
        ],
      });
      const content = response.choices?.[0]?.message?.content;
      return { summary: typeof content === "string" ? content : "The files share duplicate-like metadata; keep the highest-quality camera original." };
    }),
  }),
});

export type AppRouter = typeof appRouter;
