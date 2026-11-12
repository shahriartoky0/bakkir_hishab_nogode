import { requireUser } from "@/presentation/auth/session";
import { AppShell } from "@/presentation/components/app-shell/app-shell";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  return <AppShell user={{ name: user.name, email: user.email }}>{children}</AppShell>;
}
