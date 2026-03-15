import { z } from "zod";

export const monthKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM");

export const createMonthSchema = z.object({
  sourceMonthId: z.coerce.number(),
  targetMonthKey: z.string().regex(/^\d{4}-\d{2}$/),
});
