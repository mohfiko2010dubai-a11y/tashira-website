import { z } from 'zod';
export const productCardInput = z.object({
 serviceCode: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,79}$/, 'استخدم كودًا من حروف إنجليزية صغيرة وأرقام وشرطات.'),
 expectedVersion: z.number().int().nonnegative(),
 nameAr: z.string().trim().min(1, 'أدخل اسم المنتج بالعربية.').max(255),
 nameEn: z.string().trim().min(1, 'أدخل اسم المنتج بالإنجليزية.').max(255),
 kind: z.enum(['visa','procedure']), durationDays: z.number().int().min(1).max(3650).nullable(),
 entryType: z.enum(['single','multiple','not_applicable']), audience: z.enum(['all','adult','child']),
 enabled: z.boolean(), instructions: z.string().max(10000), requiredDocuments: z.string().max(10000),
 applicableProducts: z.array(z.string().max(80)).max(100),
}).strict();
export type ProductCardInput = z.infer<typeof productCardInput>;
