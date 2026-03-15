import { z } from "zod";

export const billTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  defaultDueDay: z.preprocess(
    (v) => {
      if (v === "" || v === undefined || v === null) return null;
      const n = Number(v);
      if (Number.isNaN(n) || n < 1 || n > 31) return null;
      return Math.floor(n);
    },
    z.number().int().min(1).max(31).nullable()
  ),
  /** Comma-separated 0–6 (Sun–Sat). When set, month generation creates one bill per occurrence. */
  dueWeekdays: z.preprocess(
    (v) => {
      if (v === "" || v === undefined || v === null) return null;
      const s = String(v).trim();
      if (!s) return null;
      const nums = s.split(",").map((x) => Number(x.trim())).filter((n) => !Number.isNaN(n) && n >= 0 && n <= 6);
      return nums.length ? [...new Set(nums)].sort((a, b) => a - b).join(",") : null;
    },
    z.string().nullable()
  ),
  defaultPlannedAmount: z.preprocess(
    (v) => (v === "" || v === undefined ? null : Number(v)),
    z.number().nullable()
  ),
  defaultPaymentUrl: z.string().url().nullable().or(z.literal("")),
  active: z.boolean(),
});

export type BillTemplateFormData = z.infer<typeof billTemplateSchema>;
