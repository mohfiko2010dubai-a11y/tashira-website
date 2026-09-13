import { afterEach, expect, it } from "vitest";
import { applicationDocumentMetadataQuery, applicationUploadQuery, createRouter } from "./middleware";
import { resetRateLimitsForTests } from "./lib/rate-limit";
import { documentUploadError } from "../contracts/document-upload-policy";

afterEach(resetRateLimitsForTests);
const router = createRouter({ storage: createRouter({ upload: applicationUploadQuery.mutation(() => true) }),
  document: createRouter({ create: applicationDocumentMetadataQuery.mutation(() => true) }) });
const context = (authenticated = true) => ({ req: new Request("https://staging.invalid/api/trpc"), resHeaders: new Headers(),
  isAdmin: false, customerApplicationReferences: new Set(authenticated ? ["TSH-SYNTHETIC"] : []) });

it("allows ten complete upload/save pairs, while still rejecting an eleventh upload", async () => {
  const ctx = context(); const caller = router.createCaller(ctx);
  for (let file = 0; file < 10; file++) {
    expect(await caller.storage.upload()).toBe(true); expect(await caller.document.create()).toBe(true);
  }
  await expect(caller.storage.upload()).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  await expect(caller.document.create()).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  expect(Number(ctx.resHeaders.get("retry-after"))).toBeGreaterThan(0);
  expect(documentUploadError("Too many requests", false)).toContain("Wait one minute, then retry");
  expect(documentUploadError("Too many requests", true)).toContain("انتظر دقيقة");
});
it("keeps authentication mandatory for both upload and metadata", async () => {
  const caller = router.createCaller(context(false));
  await expect(caller.storage.upload()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  await expect(caller.document.create()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
});
