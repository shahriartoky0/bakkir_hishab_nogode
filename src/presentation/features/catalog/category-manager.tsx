"use client";

import { Archive, ArchiveRestore, ChevronDown, ChevronUp, ListPlus, MoreVertical, Pencil, Plus, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { buildTree, type Category } from "@/domain/catalog/category";
import { archiveCategoryAction, reorderCategoriesAction, saveCategoryAction } from "../../actions/settings";
import { StatusBadge } from "../../components/status-badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { useAction } from "../../hooks/use-action";
import { useFormat } from "../../lib/format-context";
import { useText } from "../../lib/use-text";
import { cn } from "../../lib/utils";

type Editing = { id?: string; parentId: string | null; nameBn: string; nameEn: string } | null;

export function CategoryManager({ categories, fieldCounts }: { categories: Category[]; fieldCounts: Record<string, number> }) {
  const t = useTranslations("settings.categories");
  const tc = useTranslations("common");
  const text = useText();
  const fmt = useFormat();
  const { pending, run } = useAction();
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);

  const visible = categories.filter((c) => showArchived || !c.archivedAt);
  const tree = buildTree(visible);

  function move(siblings: Category[], index: number, delta: number) {
    const ids = siblings.map((s) => s.id);
    const j = index + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j]!, ids[index]!];
    run(() => reorderCategoriesAction(ids));
  }

  function save() {
    if (!editing) return;
    run(() => saveCategoryAction(editing), { success: tc("saved"), onSuccess: () => setEditing(null) });
  }

  const row = (c: Category, siblings: Category[], index: number, child: boolean) => (
    <div key={c.id} className={cn("flex items-center gap-3 px-4 py-3", child && "bg-muted/40 pl-8")}>
      <div className="min-w-0 flex-1">
        <p className={cn("leading-snug", child ? "font-medium" : "font-heading text-lg font-semibold")}>{text(c.nameBn, c.nameEn)}</p>
        <p className="truncate text-xs text-muted-foreground">{[c.nameBn, c.nameEn].filter(Boolean).join(" · ")}</p>
        {c.archivedAt && <StatusBadge tone="neutral" className="mt-1">{tc("archived")}</StatusBadge>}
      </div>
      <Button asChild variant="outline" size="sm" className="h-9 shrink-0 rounded-full">
        <Link href={`/settings/categories/${c.id}`}>
          <SlidersHorizontal className="size-4" aria-hidden />
          {t("fieldCount", { count: fmt.number(fieldCounts[c.id] ?? 0) })}
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-10 shrink-0" aria-label={tc("openMenu")} disabled={pending}>
            <MoreVertical className="size-5" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuItem className="min-h-11" onSelect={() => setEditing({ id: c.id, parentId: c.parentId, nameBn: c.nameBn ?? "", nameEn: c.nameEn ?? "" })}>
            <Pencil className="size-4" aria-hidden /> {tc("edit")}
          </DropdownMenuItem>
          {!child && !c.archivedAt && (
            <DropdownMenuItem className="min-h-11" onSelect={() => setEditing({ parentId: c.id, nameBn: "", nameEn: "" })}>
              <ListPlus className="size-4" aria-hidden /> {t("addChild")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem className="min-h-11" disabled={index === 0} onSelect={() => move(siblings, index, -1)}>
            <ChevronUp className="size-4" aria-hidden /> {tc("moveUp")}
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-11" disabled={index === siblings.length - 1} onSelect={() => move(siblings, index, 1)}>
            <ChevronDown className="size-4" aria-hidden /> {tc("moveDown")}
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-11" onSelect={() => run(() => archiveCategoryAction({ id: c.id, archived: !c.archivedAt }))}>
            {c.archivedAt ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
            {c.archivedAt ? tc("restore") : tc("archive")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button className="h-11" onClick={() => setEditing({ parentId: null, nameBn: "", nameEn: "" })}>
          <Plus className="size-5" aria-hidden /> {t("add")}
        </Button>
        <Button asChild variant="outline" className="h-11">
          <Link href="/settings/categories/global">
            <SlidersHorizontal className="size-5" aria-hidden /> {t("globalFields")}
          </Link>
        </Button>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <Switch checked={showArchived} onCheckedChange={setShowArchived} />
          {t("showArchived")}
        </label>
      </div>

      {tree.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-card/50 p-8 text-center text-muted-foreground">{t("empty")}</p>
      ) : (
        tree.map((p, i) => (
          <Card key={p.id} className="gap-0 overflow-hidden py-0">
            <CardContent className="divide-y px-0">
              {row(p, tree, i, false)}
              {p.children.map((ch, j) => row(ch, p.children, j, true))}
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? t("edit") : editing?.parentId ? t("addChild") : t("add")}</DialogTitle>
          </DialogHeader>
          {editing && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="cat-bn">{t("nameBn")}</Label>
                <Input id="cat-bn" className="h-12 text-base" value={editing.nameBn} onChange={(e) => setEditing({ ...editing, nameBn: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-en">{t("nameEn")}</Label>
                <Input id="cat-en" className="h-12 text-base" value={editing.nameEn} onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })} />
              </div>
              <p className="text-xs text-muted-foreground">{t("nameHint")}</p>
              <DialogFooter>
                <Button type="button" variant="outline" className="h-11" onClick={() => setEditing(null)}>
                  {tc("cancel")}
                </Button>
                <Button type="submit" className="h-11" disabled={pending}>
                  {tc("save")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
