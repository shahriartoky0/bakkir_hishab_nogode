import { expect, test } from "@playwright/test";
import bn from "../../messages/bn.json";
import en from "../../messages/en.json";

/**
 * Phase 1 flow, in Bangla: protected route → login → home → switch language → sign out.
 * The full credit flow (customer → sale → payment) is in due-flow.spec.ts.
 */
const email = process.env.OWNER_EMAIL ?? "";
const password = process.env.OWNER_PASSWORD ?? "";

test.skip(!email || !password, "Set OWNER_EMAIL / OWNER_PASSWORD (seeded on a Neon branch) to run e2e.");

test("login, switch language, sign out", async ({ page }) => {
  await page.goto("/customers");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: bn.auth.title })).toBeVisible();

  // wrong password shows a translated error
  await page.getByLabel(bn.auth.email).fill(email);
  await page.getByLabel(bn.auth.password, { exact: true }).fill("definitely-wrong");
  await page.getByRole("button", { name: bn.auth.submit }).click();
  await expect(page.getByRole("alert").filter({ hasText: bn.errors.INVALID_CREDENTIALS })).toBeVisible();

  await page.getByLabel(bn.auth.password, { exact: true }).fill(password);
  await page.getByRole("button", { name: bn.auth.submit }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await expect(page.getByText(bn.dashboard.totalOutstanding)).toBeVisible();

  await page.getByRole("button", { name: bn.language.switch }).first().click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByText(en.dashboard.totalOutstanding)).toBeVisible();

  // back to Bangla so the next run starts in the default language
  await page.getByRole("button", { name: en.language.switch }).first().click();
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");

  await page.goto("/more");
  await page.getByRole("button", { name: bn.auth.signOut }).click();
  await expect(page).toHaveURL(/\/login$/);
});
