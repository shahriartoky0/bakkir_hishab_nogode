import { param } from "@/presentation/lib/server";
import { ReportsScreen } from "@/presentation/features/reports/reports-screen";

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const sp = await searchParams;
  return <ReportsScreen kind={param(sp.kind)} from={param(sp.from)} to={param(sp.to)} />;
}
