import { z } from "zod";

export const monthKeySchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Must be YYYY-MM");

export const createMonthSchema = z.object({
  sourceMonthId: z.coerce.number(),
  targetMonthKey: monthKeySchema,
});
