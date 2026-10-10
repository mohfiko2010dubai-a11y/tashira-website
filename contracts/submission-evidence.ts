import { z } from 'zod';

export const submissionEvidenceInput = z.object({
  supplierId: z.number().int().positive(),
  documentId: z.number().int().positive(),
  externalReference: z.string().trim().min(1, 'أدخل رقم الطلب لدى جهة التقديم.').max(100),
  occurredAt: z.string().datetime(),
  followUpAt: z.string().datetime().optional(),
}).strict();
export type SubmissionEvidenceInput = z.infer<typeof submissionEvidenceInput>;
