import type { FieldDefinition } from "@/domain/catalog/field-definition";

type Fmt = { money: (m: number) => string; number: (n: number) => string; date: (d: string) => string };
type Pick = (bn: string | null | undefined, en: string | null | undefined) => string;

/** A stored custom field value as display text (with unit), or null when empty. */
export function customFieldText(
  f: FieldDefinition,
  value: unknown,
  ctx: { fmt: Fmt; text: Pick; yes: string; no: string },
): string | null {
  if (value === undefined || value === null || value === "") return null;
  const unit = ctx.text(f.unitBn, f.unitEn);
  let s: string;
  switch (f.type) {
    case "money":
      s = ctx.fmt.money(Number(value));
      break;
    case "number":
    case "decimal":
      s = ctx.fmt.number(Number(value));
      break;
    case "date":
      s = ctx.fmt.date(String(value));
      break;
    case "boolean":
      s = value ? ctx.yes : ctx.no;
      break;
    case "select": {
      const o = f.options.find((x) => x.value === value);
      s = o ? ctx.text(o.labelBn, o.labelEn) || o.value : String(value);
      break;
    }
    default:
      s = String(value);
  }
  return unit ? `${s} ${unit}` : s;
}

/** Stored value → raw form input (for editing a sale). */
export function customFieldInputValue(f: FieldDefinition, value: unknown): string | boolean {
  if (f.type === "boolean") return value === true;
  if (value === undefined || value === null) return "";
  if (f.type === "money") return String(Number(value) / 100);
  return String(value);
}
