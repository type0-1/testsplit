import { test, expect } from '@playwright/test'

test.describe('Dashboard navigation', () => {
  test('loads the Overview page by default', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/frontend|TestSplit/i)
    await expect(page.getByRole('button', { name: /overview/i })).toBeVisible()
  })

  test('navigates to all four pages without crashing', async ({ page }) => {
    await page.goto('/')

    for (const label of ['Durations', 'Scheduling', 'Instability', 'Overview']) {
      await page.getByRole('button', { name: new RegExp(label, 'i') }).click()
      await expect(page.getByRole('main')).toBeVisible()
    }
  })

  test('sidebar highlights the active page', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: /durations/i }).click()
    const btn = page.getByRole('button', { name: /durations/i })
    await expect(btn).toHaveAttribute('aria-current', 'page')
  })
})
