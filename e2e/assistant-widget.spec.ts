import { expect, test } from '@playwright/test'

test('assistant widget handles image attach + quota exceeded + feedback prompt', async ({ page }) => {
  await page.route('**/api/assistant/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ sessionId: 'test-session-1' }),
    })
  })

  await page.route('**/api/assistant/message', async (route) => {
    await route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'QUOTA_EXCEEDED',
        reply: 'You have reached your limit for now.',
        waitMinutes: 27,
        showFeedback: true,
        creditsRemaining: 0,
      }),
    })
  })

  await page.route('**/api/assistant/feedback', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    })
  })

  await page.goto('/')

  await page.getByLabel('Toggle EventSlot Assistant').click()
  await page.getByRole('button', { name: 'Send a Message' }).click()

  const png1x1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5e2nQAAAAASUVORK5CYII=',
    'base64'
  )

  const fileInput = page.locator('input[type="file"]').first()
  await fileInput.setInputFiles([
    {
      name: 'screenshot.png',
      mimeType: 'image/png',
      buffer: png1x1,
    },
  ])

  await expect(page.locator('img[alt=""]').first()).toBeVisible()

  await page.getByPlaceholder('Add a message about this screenshot...').fill('Please check this issue')
  await page.getByRole('button', { name: '↑' }).click()

  await expect(page.getByText('Resets in 27 minutes')).toBeVisible()
  await expect(page.getByText('How was your experience?')).toBeVisible()

  await page.getByRole('button', { name: '★' }).first().click()
  await page.getByPlaceholder('Any comments? (optional)').fill('Helpful response')
  await page.getByRole('button', { name: 'Submit Feedback' }).click()

  await expect(page.getByText('Thank you for your feedback!')).toBeVisible()
})
