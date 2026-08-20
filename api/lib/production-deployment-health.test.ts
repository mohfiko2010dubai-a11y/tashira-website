import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("manual Production deployment health gate", () => {
  it("waits for local startup and then requires a stable PM2 process", async () => {
    const workflow = await readFile(new URL("../../.github/workflows/deploy.yml", import.meta.url), "utf8");
    expect(workflow).toContain("for attempt in $(seq 1 30)");
    expect(workflow).toContain("--max-time 3 http://127.0.0.1:3000/api/health");
    expect(workflow).toContain('test "$local_healthy" = "1"');
    expect(workflow).toContain('test "$(pm2 pid tashira)" = "$app_pid"');
    expect(workflow).toContain("--max-time 10 https://tashiraev.com/");
    expect(workflow).not.toContain("StrictHostKeyChecking=no");
  });
});
