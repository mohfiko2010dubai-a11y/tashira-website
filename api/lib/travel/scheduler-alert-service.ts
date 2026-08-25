import { createHash } from "node:crypto";
import type { AuthorizationActor } from "../authorization/policy";
import type { SubmissionQueueItem } from "../operations/submission-queue";
import type { MysqlSchedulerAlertProvider } from "./mysql-scheduler-alert-provider";
import { schedulerAlertCondition } from "./scheduler-alert-engine";
import type { SchedulerAlertEvent } from "./scheduler-runtime";

function identity(value: string): string { return createHash("sha256").update(value).digest("hex"); }

/** Internal scheduler adapter. This is deliberately not exposed as a staff mutation route. */
export class SchedulerAlertService {
  private readonly provider: Pick<MysqlSchedulerAlertProvider, "create">;
  constructor(provider: Pick<MysqlSchedulerAlertProvider, "create">) { this.provider = provider; }

  async reconcile(items: readonly SubmissionQueueItem[], actor: AuthorizationActor): Promise<readonly SchedulerAlertEvent[]> {
    const events: SchedulerAlertEvent[] = [];
    for (const item of items) {
      const condition = schedulerAlertCondition(item);
      if (!condition) continue;
      const key = `${condition.applicationId}:${condition.travelGroupId}:${condition.scheduleEvaluationId}:${condition.type}`;
      events.push(await this.provider.create({ ...condition, idempotencyKey: `scheduler:${identity(key)}`,
        correlationId: `scheduler:${identity(`${key}:correlation`)}` }, actor));
    }
    return events;
  }
}
