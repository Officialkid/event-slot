import { expect, test } from '@playwright/test'

test('homepage loads', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/EventSlot/i)
})

test('how-it-works page loads', async ({ page }) => {
  await page.goto('/how-it-works')
  await expect(page.locator('h1')).toBeVisible()
})

test('signin page renders form', async ({ page }) => {
  await page.goto('/signin')
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
})

test('signup page renders form', async ({ page }) => {
  await page.goto('/signup')
  await expect(page.locator('input[type="text"]')).toBeVisible()
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
})
