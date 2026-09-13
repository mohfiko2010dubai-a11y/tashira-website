import { z } from "zod";
import records from "./testimonials.json";

const testimonialSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  country: z.string().trim().min(1),
  textEn: z.string().trim().min(1),
  textAr: z.string().trim().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  status: z.enum(["draft", "published"]),
}).strict();
export type Testimonial = z.infer<typeof testimonialSchema>;

export function publishedTestimonials(source: unknown = records): Testimonial[] {
  if (!Array.isArray(source)) return [];
  return source.flatMap(record => {
    const parsed = testimonialSchema.safeParse(record);
    return parsed.success && parsed.data.status === "published" ? [parsed.data] : [];
  });
}
