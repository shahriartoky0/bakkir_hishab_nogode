import { MessageCircle, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

/** "+8801712345678" → "tel:+8801712345678" */
export const telHref = (e164: string) => `tel:${e164}`;
/** wa.me wants the number without "+". */
export const whatsappHref = (e164: string) => `https://wa.me/${e164.replace(/^\+/, "")}`;

/** One-tap Call and WhatsApp (spec 1: no SMS, no reminders). */
export function ContactButtons({
  phone,
  name,
  compact,
  className,
}: {
  phone: string;
  name: string;
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("common");
  const size = compact ? "icon" : "default";
  const cls = compact ? "size-11" : "h-11 flex-1";
  return (
    <div className={cn("flex gap-2", className)}>
      <Button asChild variant="outline" size={size} className={cls}>
        <a href={telHref(phone)} aria-label={t("callName", { name })}>
          <Phone className="size-5" aria-hidden />
          {!compact && t("call")}
        </a>
      </Button>
      <Button asChild variant="outline" size={size} className={cn(cls, "text-success")}>
        <a href={whatsappHref(phone)} target="_blank" rel="noopener noreferrer" aria-label={t("whatsappName", { name })}>
          <MessageCircle className="size-5" aria-hidden />
          {!compact && t("whatsapp")}
        </a>
      </Button>
    </div>
  );
}
