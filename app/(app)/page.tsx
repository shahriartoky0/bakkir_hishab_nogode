import { requireUser } from "@/presentation/auth/session";
import { DashboardScreen } from "@/presentation/features/collections/collection-screens";

export default async function HomePage() {
  const user = await requireUser();
  return <DashboardScreen userName={user.name} />;
}
