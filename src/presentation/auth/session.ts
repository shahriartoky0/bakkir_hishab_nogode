import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { AuthenticatedUser } from "@/application/ports/authenticator";
import { container } from "@/composition/container";

/** Current user for this request (deduplicated per render), or null. */
export const getCurrentUser = cache(async (): Promise<AuthenticatedUser | null> => {
  return container.session().currentUser();
});

/** For pages/layouts: the signed-in user, or redirect to /login. */
export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
