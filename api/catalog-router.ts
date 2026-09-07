import { z } from "zod";
import { publicQuery, createRouter } from "./middleware";
import { getActiveCatalogProducts } from "./lib/visa-catalog";

export const catalogRouter = createRouter({
  listActiveProducts: publicQuery
    .input(z.object({ at: z.coerce.date().optional() }).strict().optional())
    .query(async ({ input }) => {
      const products = await getActiveCatalogProducts(input?.at);
      return products;
    }),
});
