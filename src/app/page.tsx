import { redirect } from "next/navigation";
import { getOpenMonthKey } from "@/features/months/actions";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const openMonthKey = await getOpenMonthKey();
  if (openMonthKey) redirect(`/months/${openMonthKey}`);
  redirect("/months");
}
