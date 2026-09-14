import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./context";
const access = vi.hoisted(() => vi.fn());
const database = vi.hoisted(() => vi.fn());
vi.mock("./lib/application-access", () => ({ assertApplicationIdAccess: access }));
vi.mock("./queries/connection", () => ({ getDb: database }));
vi.mock("./lib/application-timeline", () => ({ recordTimelineEvent: vi.fn() }));
import { applicationSupplementsRouter } from "./application-supplements-router";
import { mayAddSupportingDocument } from "../contracts/application-supplements";

describe("optional application additions ownership", () => {
  beforeEach(() => { vi.clearAllMocks(); access.mockRejectedValue(new TRPCError({ code: "FORBIDDEN" })); });
  const context: TrpcContext = { req: new Request("https://staging.example/api/trpc"), resHeaders: new Headers(), isAdmin: false, customerApplicationReferences: new Set(["OWNED-SYNTHETIC"]) };
  it("denies foreign reads and every write before accessing additions", async () => {
    const caller = applicationSupplementsRouter.createCaller(context);
    for (const request of [() => caller.get({ applicationId: 2 }), () => caller.saveNotes({ applicationId: 2, notes: "synthetic" }),
      () => caller.saveSponsor({ applicationId: 2, name: "Synthetic Sponsor", relation: "Parent" }), () => caller.linkDocument({ applicationId: 2, documentId: 1 })]) {
      await expect(request()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(access).toHaveBeenCalledTimes(4);
    expect(database).not.toHaveBeenCalled();
  });
  it("allows six saved files and replay but refuses a seventh", () => {
    expect(mayAddSupportingDocument(5, false)).toBe(true);
    expect(mayAddSupportingDocument(6, false)).toBe(false);
    expect(mayAddSupportingDocument(6, true)).toBe(true);
  });
});
