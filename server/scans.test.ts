import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function unauthenticatedContext(): TrpcContext {
  return {
    user: undefined,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("scan procedures", () => {
  it("rejects scan history for anonymous users", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext());
    await expect(caller.scans.history()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("exposes the authenticated AI summary procedure", () => {
    expect(appRouter._def.procedures).toHaveProperty("scans.aiSummary");
  });
});
