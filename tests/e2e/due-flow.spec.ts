import { expect, test, type Page } from "@playwright/test";
import bn from "../../messages/bn.json";
import en from "../../messages/en.json";

/**
 * The core credit flow, in Bangla (spec 9):
 * login → create customer → create sale with photo → receive partial payment →
 * see the updated balance and the customer in the overdue list.
 *
 * A sale is always dated today, so to have something overdue the test also moves an
 * "old khata" opening balance in with a past due date. Needs a seeded Neon *branch*
 * and working photo storage.
 */
const email = process.env.OWNER_EMAIL ?? "";
const password = process.env.OWNER_PASSWORD ?? "";

test.skip(!email || !password, "Set OWNER_EMAIL / OWNER_PASSWORD (seeded on a Neon branch) to run e2e.");

// 1×1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const toBn = (s: string) => s.replace(/\d/g, (d) => BN_DIGITS[Number(d)]!);

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel(bn.auth.email).fill(email);
  await page.getByLabel(bn.auth.password, { exact: true }).fill(password);
  await page.getByRole("button", { name: bn.auth.submit }).click();
  await expect(page).toHaveURL(/\/$/);
}

test("customer → sale with photo → partial payment → balance and overdue list", async ({ page }) => {
  test.setTimeout(180_000);
  const suffix = String(Date.now()).slice(-8);
  const phone = `017${suffix}`;
  const name = `E2E ${suffix}`;

  await login(page);

  // 1. customer (phone typed in Bangla digits, as a Bangla keyboard would)
  await page.goto("/customers/new");
  await page.getByLabel(bn.customers.form.phone).fill(toBn(phone));
  await page.getByLabel(bn.customers.form.name, { exact: true }).fill(name);
  await page.getByRole("button", { name: bn.common.save }).click();
  await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+$/);
  const customerUrl = page.url();

  // 2. sale with a photo: ৳ 10,000, due in 7 days
  await page.getByRole("link", { name: bn.customers.profile.newSale }).click();
  await expect(page.getByRole("heading", { name: bn.sales.wizard.steps.items })).toBeVisible();
  await page.locator('input[type="file"][capture]').first().setInputFiles({ name: "ring.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText(bn.photos.count.replace("{count}", "১").replace("{max}", "৬"))).toBeVisible({ timeout: 30_000 });
  await page.getByLabel(bn.sales.item.name).fill("আংটি");
  await page.getByLabel(bn.sales.item.price).fill("১০০০০");
  await page.getByRole("button", { name: bn.common.next }).click();
  await page.getByRole("button", { name: bn.common.next }).click(); // no discount / upfront
  await page.getByRole("button", { name: bn.sales.schedule.plusDays.replace("{days}", "৭") }).click();
  await page.getByRole("button", { name: bn.common.next }).click();
  await page.getByRole("button", { name: bn.sales.wizard.save }).click();
  await expect(page).toHaveURL(/\/sales\/[0-9a-f-]+$/);
  await expect(page.getByText("৳ ১০,০০০").first()).toBeVisible();

  // 3. old khata balance, due 10 days ago → overdue
  await page.goto(`${customerUrl}/adjust`);
  await page.getByRole("button", { name: new RegExp(bn.enums.adjustmentType.opening_balance.replace(/[()]/g, ".")) }).click();
  await page.getByLabel(bn.payments.adjust.amount).fill("৫০০০");
  const past = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel(bn.payments.adjust.dueDate).fill(past);
  await page.getByLabel(bn.common.reason).fill("পুরনো খাতা");
  await page.getByRole("button", { name: bn.common.save }).click();
  await expect(page).toHaveURL(customerUrl);
  await expect(page.getByText("৳ ১৫,০০০").first()).toBeVisible();

  // 4. partial payment ৳ 2,000 (oldest due first → the opening balance)
  await page.getByRole("link", { name: bn.customers.profile.receivePayment }).click();
  await page.getByLabel(bn.payments.form.amount).fill("২০০০");
  await page.getByRole("button", { name: bn.enums.paymentMethod.bkash }).click();
  await page.getByLabel(bn.payments.form.reference).fill("TRX123");
  await page.getByRole("button", { name: bn.payments.form.submit }).click();
  await expect(page).toHaveURL(/\/payments\/[0-9a-f-]+$/);
  await expect(page.getByText(bn.print.paymentReceipt)).toBeVisible();
  await expect(page.getByText("৳ ১৩,০০০")).toBeVisible(); // balance after

  // 5. updated balance on the profile, and listed as overdue today
  await page.goto(customerUrl);
  await expect(page.getByText("৳ ১৩,০০০").first()).toBeVisible();
  await expect(page.getByText("৳ ৩,০০০").first()).toBeVisible(); // overdue part

  await page.goto("/today");
  const overdue = page.locator("section", { has: page.getByRole("heading", { name: bn.collections.sections.overdue }) });
  await expect(overdue.getByText(name)).toBeVisible();
});
