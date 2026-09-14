import { and, eq } from 'drizzle-orm';
import { applications } from '@db/schema';

/** Test rows stay intact and accessible by reference, but never count as sales. */
export function financialApplicationScope() {
  return and(eq(applications.dataClassification, 'LIVE'), eq(applications.isTest, false))!;
}
