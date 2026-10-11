import { productCardInput } from '../contracts/product-card';
import { listProductCards, saveProductCard, saveProductSellingPrice } from './lib/product-cards';
import { nationalityProductRules } from "../contracts/nationality-product";
import { productAvailability, updateProductAvailability } from "./lib/product-availability";
import { nationalityAvailability, updateNationalityAvailability } from "./lib/nationality-availability";
import { z } from "zod";
import { adminQuery, publicQuery, createRouter } from "./middleware";
import { getActiveCatalogProducts } from "./lib/visa-catalog";

export const catalogRouter = createRouter({
  saveSellingPrice: adminQuery.input(z.object({serviceCode:z.string().min(1).max(80),processingType:z.enum(['regular','express']),expectedVersion:z.number().int().nonnegative(),amount:z.string().regex(/^(0|[1-9]\d{0,5})(\.\d{1,2})?$/).refine(v=>Number(v)>0),currency:z.enum(['AED','USD'])}).strict()).mutation(({input,ctx})=>saveProductSellingPrice(input,ctx.staffId?`staff:${ctx.staffId}`:'admin-session')),
  productCards: adminQuery.query(() => listProductCards()),
  saveProductCard: adminQuery.input(productCardInput).mutation(({input,ctx}) => saveProductCard(input,ctx.staffId?`staff:${ctx.staffId}`:ctx.user?.id?`user:${ctx.user.id}`:'admin-session')),
  nationalityAvailability: publicQuery.query(() => nationalityAvailability()),
  updateNationalityAvailability: adminQuery.input(z.object({ codes: z.array(z.string().regex(/^[A-Z]{2}$/)).max(250), rules: nationalityProductRules.optional(), expectedVersion: z.number().int().positive() }).strict()).mutation(({ input, ctx }) => updateNationalityAvailability(input, ctx.user?.id ? `user:${ctx.user.id}` : "admin-session")),
  adminProducts: adminQuery.query(() => productAvailability()),
  updateProduct: adminQuery.input(z.object({ serviceCode: z.string().min(1).max(80), expectedVersion: z.number().int().positive(), isActive: z.boolean(), verificationSource: z.string().url().startsWith("https://").max(1000).optional() }).strict()).mutation(({ input, ctx }) => updateProductAvailability(input, ctx.user?.id ? `user:${ctx.user.id}` : "admin-session")),
  listActiveProducts: publicQuery
    .input(z.object({ at: z.coerce.date().optional() }).strict().optional())
    .query(async ({ input }) => {
      const products = await getActiveCatalogProducts(input?.at);
      return products;
    }),
});
