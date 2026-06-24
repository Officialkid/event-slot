import { expect, test } from "@playwright/test"

const ADMIN_EMAIL = "admin@eventslot.test"
const ADMIN_PASSWORD = "TestPass2024!"

async function signInAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/signin", { waitUntil: "domcontentloaded" })
  await expect(page.getByLabel("Email address")).toBeVisible({ timeout: 45000 })
  await page.getByLabel("Email address").fill(ADMIN_EMAIL)
  await page.locator("#signin-password").fill(ADMIN_PASSWORD)
  await page.getByRole("button", { name: /^sign in$/i }).click()
  await page.waitForLoadState("networkidle").catch(() => null)
  await page.waitForTimeout(2500)

  const bodyText = await page.locator("body").innerText()
  if (/invalid email or password/i.test(bodyText)) {
    throw new Error(
      "Seeded admin account was not available. Run the safe test-data seed in an isolated test database before relying on authenticated E2E coverage."
    )
  }

  await expect(page).not.toHaveURL(/\/signin/, { timeout: 15000 })
}

test.describe("latest pricing, checkout, and commission surfaces", () => {
  test.describe.configure({ mode: "serial" })

  test("public pricing page shows the new plan-selection UI", async ({ page }) => {
    test.setTimeout(90000)
    await page.goto("/pricing", { waitUntil: "domcontentloaded" })

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Pricing plans for organisers at every stage.")
    await expect(page.getByRole("button", { name: "Monthly" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Yearly" })).toBeVisible()
    await expect(page.getByText("Tax shown separately")).toBeVisible()
    await expect(page.getByText("Most popular")).toBeVisible()
    await expect(page.getByText("Standard:")).toBeVisible()
    await expect(page.getByText("Pro:")).toBeVisible()
    await expect(page.getByText("Business:")).toBeVisible()
  })

  test("billing page shows the postponed rollout date and upgrade section", async ({ page }) => {
    test.setTimeout(90000)
    await signInAsAdmin(page)
    await page.goto("/dashboard/billing", { waitUntil: "domcontentloaded" })

    await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible()
    await expect(
      page.getByText("Your current events remain on open access until 1 July 2026, 12:00 AM EAT.")
    ).toBeVisible()
    await expect(page.getByText("Upgrade your plan")).toBeVisible()
    await expect(page.getByRole("button", { name: "Monthly" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Yearly" })).toBeVisible()
  })

  test("checkout page shows separate tax and both payment methods", async ({ page }) => {
    test.setTimeout(90000)
    await signInAsAdmin(page)
    await page.goto("/dashboard/billing/checkout?plan=pro&cycle=annual", { waitUntil: "domcontentloaded" })

    await expect(page.getByRole("heading", { name: "Upgrade your plan" })).toBeVisible()
    await expect(page.getByText("Order details")).toBeVisible()
    await expect(page.getByText("Tax 16%")).toBeVisible()
    await expect(page.getByText("Total due today")).toBeVisible()
    await expect(page.getByText("Card checkout")).toBeVisible()
    await expect(page.getByText("M-Pesa checkout")).toBeVisible()

    await page.getByRole("button", { name: /yearly/i }).click()
    await expect(page.getByText("Save 17%")).toBeVisible()

    await page.getByRole("button", { name: /M-Pesa checkout/i }).click()
    await expect(
      page.getByText("You will continue to a secure hosted payment page to complete M-Pesa checkout.")
    ).toBeVisible()
  })

  test("admin payment test page exposes commission scenarios for all plans", async ({ page }) => {
    test.setTimeout(90000)
    await signInAsAdmin(page)
    await page.goto("/admin/test/payments", { waitUntil: "domcontentloaded" })

    await expect(page.getByText("Standard Plan Main Run")).toBeVisible()
    await expect(page.getByText("Free Plan Mini-Test")).toBeVisible()
    await expect(page.getByText("Pro Plan Mini-Test")).toBeVisible()
    await expect(page.getByText("Business Plan Mini-Test")).toBeVisible()

    await expect(page.getByText("Standard Plan Main Run").locator("..")).toContainText("8%")
    await expect(page.getByText("Free Plan Mini-Test").locator("..")).toContainText("10%")
    await expect(page.getByText("Pro Plan Mini-Test").locator("..")).toContainText("5%")
    await expect(page.getByText("Business Plan Mini-Test").locator("..")).toContainText("3%")
  })
})
