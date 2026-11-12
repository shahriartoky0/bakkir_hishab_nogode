"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import type { ActionResult } from "../actions/result";
import { useAction } from "../hooks/use-action";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

/** Confirm a destructive-but-recorded action (cancel sale, void payment) with a required reason. */
export function ReasonDialog({
  trigger,
  title,
  description,
  confirmLabel,
  success,
  action,
}: {
  trigger: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: ReactNode;
  success: string;
  action: (reason: string) => Promise<ActionResult<null>>;
}) {
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { pending, run } = useAction();
  const tooShort = reason.trim().length < 3;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="reason">{tc("reason")}</Label>
          <Textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={() => setOpen(false)}>
            {tc("cancel")}
          </Button>
          <Button
            variant="destructive"
            className="h-11"
            disabled={pending || tooShort}
            onClick={() => run(() => action(reason.trim()), { success, onSuccess: () => (setOpen(false), setReason("")) })}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
