import { relations } from "drizzle-orm";
import { applications, applicants } from "./schema";

export const applicationsRelations = relations(applications, ({ many }) => ({
  applicants: many(applicants),
}));

export const applicantsRelations = relations(applicants, ({ one }) => ({
  application: one(applications, {
    fields: [applicants.applicationId],
    references: [applications.id],
  }),
}));
