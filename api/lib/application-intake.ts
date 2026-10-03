import fs from "node:fs";
import { TRPCError } from "@trpc/server";
import { INTAKE_CLOSED_COPY } from "@contracts/application-intake";

// Read on every request: reopening requires an atomic config edit, not a deploy.
export function readApplicationIntake() {
  const configPath = process.env.APPLICATION_INTAKE_CONFIG_PATH;
  if (!configPath) return { closed: true };
  try {
    const config: unknown = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (typeof config !== "object" || config === null || !("closed" in config) || typeof config.closed !== "boolean") {
      return { closed: true };
    }
    return { closed: config.closed };
  } catch {
    // Missing/unreadable/malformed production configuration must not reopen intake.
    return { closed: true };
  }
}

export function assertApplicationIntakeOpen() {
  if (readApplicationIntake().closed) {
    throw new TRPCError({ code: "FORBIDDEN", message: `${INTAKE_CLOSED_COPY.en} ${INTAKE_CLOSED_COPY.ar}` });
  }
}
