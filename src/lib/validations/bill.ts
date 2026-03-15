import { z } from "zod";

export const billInstanceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  dueDate: z.string().nullable(),
  plannedAmount: z.coerce.number().nullable(),
  invoiceAmount: z.coerce.number().nullable(),
  amountPaid: z.coerce.number().nullable(),
  status: z.enum(["scheduled", "pending", "paid", "skipped"]),
  notes: z.string().nullable(),
  paymentUrl: z.string().url().nullable().or(z.literal("")),
  assignedIncomeEventId: z.coerce.number().nullable(),
  assignedGroupKey: z.string().nullable(),
  manualAssignment: z.boolean(),
  templateId: z.coerce.number().nullable(),
  isRecurring: z.boolean(),
});

export type BillInstanceFormData = z.infer<typeof billInstanceSchema>;
