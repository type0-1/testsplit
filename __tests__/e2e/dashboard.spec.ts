import { test, expect } from '@playwright/test'
import { execSync } from 'child_process'

const JUNIT_FIXTURE_DIR = '__tests__/backend/unit/parser/fixtures/multi-suite.xml'
const E2E_DATA_DIR = '.data-e2e'

test.beforeAll(() => {
  execSync(
    `npx ts-node src/backend/cli/cli.ts profile --junit ${JUNIT_FIXTURE_DIR} --jobs 2 --data ${E2E_DATA_DIR}`,
    { stdio: 'pipe' },
  )
})

function seedDockerApiDataIfAvailable(): boolean {
  try {
    execSync('docker inspect testsplit-api', { stdio: 'ignore' })
    execSync(
      `docker exec testsplit-api npx ts-node src/backend/cli/cli.ts profile --junit ${JUNIT_FIXTURE_DIR} --jobs 2 --data ${E2E_DATA_DIR}`,
      { stdio: 'pipe' },
    )
    return true
  } catch {
    return false
  }
}

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

  test('loads with real profiled data after a profile run', async ({ page }) => {
    const summaryStatus = async () => {
      const response = await page.request.get('/api/summary')
      return response.status()
    }

    if ((await summaryStatus()) === 404) {
      seedDockerApiDataIfAvailable()
    }

    await expect.poll(summaryStatus, { timeout: 20000, intervals: [500, 1000, 2000] }).toBe(200)

    await page.goto('/')
    await expect(page.getByText(/Duration Trend/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/No profiling data found/i)).toHaveCount(0)
    await expect(page.getByText(/No distribution data found/i)).toHaveCount(0)

    const runBadge = page.getByText(/^RUN\s+\d+$/)
    await expect(runBadge).toBeVisible()

    const runBadgeText = await runBadge.innerText()
    const runCount = Number.parseInt(runBadgeText.replace(/\D/g, ''), 10)
    expect(runCount).toBeGreaterThan(0)
  })
})
