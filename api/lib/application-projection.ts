import { eq } from "drizzle-orm";
import { applications, applicants, suppliers } from "@db/schema";
import { getDb } from "../queries/connection";

/**
 * Canonical customer-facing application projection.
 *
 * This is the single read surface for "application by reference number":
 * every router that exposes application state to a customer must delegate
 * here so shapes cannot drift between `application.getByReference` and
 * legacy compatibility endpoints (e.g. `wizard.getByReference`).
 */
export async function getCanonicalApplicationByReference(referenceNumber: string) {
  const db = getDb();
  const [app] = await db.select().from(applications)
    .where(eq(applications.referenceNumber, referenceNumber)).limit(1);
  if (!app) return null;
  const applicantList = await db.select().from(applicants)
    .where(eq(applicants.applicationId, app.id));
  let supplier = null;
  try {
    if (app.supplierId) {
      const [s] = await db.select().from(suppliers)
        .where(eq(suppliers.id, app.supplierId)).limit(1);
      supplier = s || null;
    }
  } catch {
    // supplierId column may not exist yet
  }
  return { ...app, applicants: applicantList, supplier };
}
