import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("native staging deployment safety", () => {
  it("uses one guarded build and deployment path", async () => {
    const [vite, build, deploy, verify] = await Promise.all([
      readFile(new URL("../../vite.config.ts", import.meta.url), "utf8"),
      readFile(new URL("../../staging/build-native.mjs", import.meta.url), "utf8"),
      readFile(new URL("../../staging/deploy-native.mjs", import.meta.url), "utf8"),
      readFile(new URL("../../staging/verify-native-build.mjs", import.meta.url), "utf8"),
    ]);

    expect(vite).toContain("Native staging builds must use node staging/build-native.mjs");
    expect(build).toContain("staging/verify-native-build.mjs");
    expect(deploy).toContain('run(process.execPath, ["staging/build-native.mjs"])');
    expect(deploy).toContain('["restart", "tashira-staging", "--update-env"]');
    expect(verify).toContain("paymentSource.includes(publishableKey)");
  });
});
