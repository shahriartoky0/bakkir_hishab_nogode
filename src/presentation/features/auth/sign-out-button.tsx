"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { signOutAction } from "../../actions/auth";
import { Button } from "../../components/ui/button";

export function SignOutButton() {
  const t = useTranslations("auth");
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      className="h-12 w-full"
      disabled={pending}
      onClick={() => startTransition(() => signOutAction())}
    >
      <LogOut className="size-5" aria-hidden /> {t("signOut")}
    </Button>
  );
}
