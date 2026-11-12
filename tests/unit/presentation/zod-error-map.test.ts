import { describe, expect, it } from "vitest";
import { z } from "zod";
import bnMessages from "../../../messages/bn.json";
import enMessages from "../../../messages/en.json";
import { integerField, moneyField, phoneField, shopDateField } from "@/presentation/schemas/fields";
import { createZodErrorMap, type ValidationTranslator } from "@/presentation/schemas/zod-error-map";

/** Minimal ICU-ish translator over the real message files ({name} placeholders only). */
function translator(messages: { validation: Record<string, string> }): ValidationTranslator {
  return (key, values) =>
    (messages.validation[key] ?? key).replace(/\{(\w+)\}/g, (_, k: string) => String(values?.[k] ?? ""));
}

const bnMap = createZodErrorMap(translator(bnMessages));
const enMap = createZodErrorMap(translator(enMessages));

function firstMessage(schema: z.ZodType, input: unknown, error = enMap): string | undefined {
  const r = schema.safeParse(input, { error });
  return r.success ? undefined : r.error.issues[0]?.message;
}

describe("zod error map per locale", () => {
  it("translates required / too short", () => {
    expect(firstMessage(z.object({ a: z.string() }), {})).toBe("This field is required");
    expect(firstMessage(z.string().min(1), "")).toBe("This field is required");
    expect(firstMessage(z.string().min(8), "abc")).toBe("Enter at least 8 characters");
    expect(firstMessage(z.string().min(1), "", bnMap)).toBe("এই ঘরটি পূরণ করুন");
  });

  it("translates email format", () => {
    expect(firstMessage(z.email(), "nope", bnMap)).toBe("সঠিক ইমেইল লিখুন");
  });

  it("translates custom refinements by key", () => {
    expect(firstMessage(phoneField(), "123")).toBe("Enter a valid mobile number (01XXXXXXXXX)");
    expect(firstMessage(moneyField(), "12.345", bnMap)).toBe("দশমিকের পরে সর্বোচ্চ ২ ঘর (পয়সা)");
    expect(firstMessage(moneyField(), "abc", bnMap)).toBe("শুধু সংখ্যা লিখুন");
  });
});

describe("form fields accept Bangla digits", () => {
  it("phone → E.164", () => {
    expect(phoneField().parse("০১৭১২৩৪৫৬৭৮")).toBe("+8801712345678");
  });

  it("money → paisa", () => {
    expect(moneyField().parse("১,২৫০.৫০")).toBe(125_050);
  });

  it("integer", () => {
    expect(integerField({ min: 1 }).parse("১২")).toBe(12);
    expect(integerField({ min: 1 }).safeParse("০").success).toBe(false);
    expect(integerField().safeParse("1.5").success).toBe(false);
  });

  it("shop date", () => {
    expect(shopDateField().parse("২০২৬-১১-১২")).toBe("2026-11-12");
    expect(shopDateField().safeParse("2026-02-30").success).toBe(false);
  });
});
