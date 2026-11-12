import { redirect } from "next/navigation";
import { getCurrentUser } from "@/presentation/auth/session";
import { LoginScreen } from "@/presentation/features/auth/login-screen";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return <LoginScreen />;
}
