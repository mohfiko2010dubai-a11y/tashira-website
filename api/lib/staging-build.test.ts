import { describe, expect, it } from "vitest";

describe("native staging deployment safety", () => {
  it("uses one guarded build and deployment path", async () => {
    const [vite, build, deploy, verify] = await Promise.all([
      import("../../vite.config.ts?raw").then((module) => module.default),
      import("../../staging/build-native.mjs?raw").then((module) => module.default),
      import("../../staging/deploy-native.mjs?raw").then((module) => module.default),
      import("../../staging/verify-native-build.mjs?raw").then((module) => module.default),
    ]);

    expect(vite).toContain("Native staging builds must use node staging/build-native.mjs");
    expect(build).toContain("staging/verify-native-build.mjs");
    expect(deploy).toContain('run(process.execPath, ["staging/build-native.mjs"])');
    expect(deploy).toContain('["restart", "tashira-staging", "--update-env"]');
    expect(verify).toContain("paymentSource.includes(publishableKey)");
  });
});
