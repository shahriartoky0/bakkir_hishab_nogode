import { describe, expect, it } from "vitest";
import { PhoneNumber } from "@/domain/shared/phone-number";
import { unwrap } from "@/domain/shared/result";

describe("PhoneNumber.parse normalizes to E.164", () => {
  it.each([
    "01712345678",
    "8801712345678",
    "+8801712345678",
    "008801712345678",
    "+880 1712-345678",
    "(017) 1234-5678",
    "1712345678",
    "০১৭১২৩৪৫৬৭৮",
    "+৮৮০১৭১২৩৪৫৬৭৮",
  ])("%s → +8801712345678", (input) => {
    expect(unwrap(PhoneNumber.parse(input)).e164).toBe("+8801712345678");
  });

  it.each(["013", "015", "016", "017", "018", "019", "014"])("accepts operator prefix %s", (p) => {
    expect(PhoneNumber.parse(`${p}12345678`).ok).toBe(true);
  });

  it.each([
    "",
    "01212345678", // 012 is not a mobile prefix
    "0171234567", // too short
    "017123456789", // too long
    "+911712345678", // not Bangladesh
    "01712abc678",
    "02-9123456", // landline
  ])("rejects %j", (input) => {
    const r = PhoneNumber.parse(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("INVALID_PHONE");
  });
});

describe("PhoneNumber views", () => {
  const p = unwrap(PhoneNumber.parse("01712345678"));

  it("exposes national, tel and WhatsApp forms", () => {
    expect(p.national).toBe("01712345678");
    expect(p.telUri).toBe("tel:+8801712345678");
    expect(p.whatsappDigits).toBe("8801712345678");
    expect(p.whatsappUrl).toBe("https://wa.me/8801712345678");
  });

  it("rebuilds from stored E.164 and rejects corrupt values", () => {
    expect(PhoneNumber.fromE164("+8801712345678").equals(p)).toBe(true);
    expect(() => PhoneNumber.fromE164("01712345678")).toThrow();
  });
});
