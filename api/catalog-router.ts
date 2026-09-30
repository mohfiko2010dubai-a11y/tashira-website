import { productAvailability, updateProductAvailability } from "./lib/product-availability";
import { z } from "zod";
import { adminQuery, publicQuery, createRouter } from "./middleware";
import { getActiveCatalogProducts } from "./lib/visa-catalog";

export const catalogRouter = createRouter({
  adminProducts: adminQuery.query(() => productAvailability()),
  updateProduct: adminQuery.input(z.object({ serviceCode: z.string().min(1).max(80), expectedVersion: z.number().int().positive(), isActive: z.boolean(), verificationSource: z.string().url().startsWith("https://").max(1000).optional() }).strict()).mutation(({ input, ctx }) => updateProductAvailability(input, ctx.user?.id ? `user:${ctx.user.id}` : "admin-session")),
  listActiveProducts: publicQuery
    .input(z.object({ at: z.coerce.date().optional() }).strict().optional())
    .query(async ({ input }) => {
      const products = await getActiveCatalogProducts(input?.at);
      return products;
    }),
});
