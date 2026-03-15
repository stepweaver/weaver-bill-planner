import { z } from "zod";

export const incomeEventSchema = z.object({
  name: z.string().min(1, "Name is required"),
  expectedDate: z.string().min(1, "Date is required"),
  expectedAmount: z.coerce.number().nullable(),
  actualAmount: z.coerce.number().nullable(),
  status: z.enum(["expected", "received"]),
  notes: z.string().nullable(),
});

export type IncomeEventFormData = z.infer<typeof incomeEventSchema>;
