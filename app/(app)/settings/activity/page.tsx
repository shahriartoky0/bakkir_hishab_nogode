import { param } from "@/presentation/lib/server";
import { ActivityScreen } from "@/presentation/features/settings/admin-screens";

export default async function ActivityPage({ searchParams }: PageProps<"/settings/activity">) {
  const sp = await searchParams;
  return <ActivityScreen before={param(sp.before)} entity={param(sp.entity)} />;
}
