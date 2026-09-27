import { z } from "zod";

/** Empty amount paid stays null so it can default from amount due. Other numbers coerce. */
const amountPaidSchema = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  z.coerce.number().nullable()
);

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid due date.")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return false;
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "Enter a valid due date.");

export const billDueDateSchema = isoDateSchema.nullable();

export const billQuickStatusSchema = z.enum(["pending", "paid"]);

export const billInstanceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  dueDate: z.string().nullable(),
  plannedAmount: z.coerce.number().nullable(),
  invoiceAmount: z.coerce.number().nullable(),
  amountPaid: amountPaidSchema,
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
