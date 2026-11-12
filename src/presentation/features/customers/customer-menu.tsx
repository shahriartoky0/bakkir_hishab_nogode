"use client";

import { Archive, ArchiveRestore, Ban, CircleCheck, MoreVertical, Pencil, Scale } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { setCustomerStatusAction } from "../../actions/customers";
import { Button } from "../../components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import { useAction } from "../../hooks/use-action";

export function CustomerMenu({ id, blocked, archived }: { id: string; blocked: boolean; archived: boolean }) {
  const t = useTranslations("customers.profile");
  const tc = useTranslations("common");
  const { pending, run } = useAction();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="size-11" aria-label={tc("openMenu")} disabled={pending}>
          <MoreVertical className="size-5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuItem asChild className="min-h-11">
          <Link href={`/customers/${id}/edit`}>
            <Pencil className="size-4" aria-hidden /> {tc("edit")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="min-h-11">
          <Link href={`/customers/${id}/adjust`}>
            <Scale className="size-4" aria-hidden /> {t("adjust")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" onSelect={() => run(() => setCustomerStatusAction({ id, blocked: !blocked }), { success: tc("saved") })}>
          {blocked ? <CircleCheck className="size-4" aria-hidden /> : <Ban className="size-4" aria-hidden />}
          {blocked ? t("unblock") : t("block")}
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" onSelect={() => run(() => setCustomerStatusAction({ id, archived: !archived }), { success: tc("saved") })}>
          {archived ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
          {archived ? tc("restore") : tc("archive")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
