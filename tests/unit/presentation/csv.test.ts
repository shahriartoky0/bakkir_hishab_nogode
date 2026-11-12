import { describe, expect, it } from "vitest";
import { takaValue, toCsv } from "@/presentation/lib/csv";

describe("csv", () => {
  it("adds a BOM, quotes special cells and uses CRLF", () => {
    const out = toCsv(["নাম", "amount"], [
      ["রহিম, করিম", 1250.5],
      ['say "hi"', null],
      ["line\nbreak", 0],
    ]);
    expect(out.startsWith("﻿")).toBe(true);
    expect(out).toBe('﻿নাম,amount\r\n"রহিম, করিম",1250.5\r\n"say ""hi""",\r\n"line\nbreak",0\r\n');
  });

  it("neutralises formula injection in text cells but not numbers", () => {
    expect(toCsv(["a"], [["=HYPERLINK(1)"], [-5]])).toBe("﻿a\r\n'=HYPERLINK(1)\r\n-5\r\n");
  });

  it("converts paisa to taka", () => {
    expect(takaValue(125_000_00)).toBe(125_000);
    expect(takaValue(50)).toBe(0.5);
  });
});
