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

test.describe('Theme toggle', () => {
  test('toggles light mode class on the html element', async ({ page }) => {
    await page.goto('/')
    const html = page.locator('html')

    // Default is dark — no 'light' class
    await expect(html).not.toHaveClass(/light/)

    // Click the theme toggle button in the sidebar
    await page.getByRole('button', { name: /switch to light mode/i }).click()
    await expect(html).toHaveClass(/light/)

    // Toggle back to dark
    await page.getByRole('button', { name: /switch to dark mode/i }).click()
    await expect(html).not.toHaveClass(/light/)
  })

  test('persists theme preference across page reloads', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /switch to light mode/i }).click()
    await expect(page.locator('html')).toHaveClass(/light/)

    await page.reload()
    // localStorage-persisted preference should restore light class
    await expect(page.locator('html')).toHaveClass(/light/)

    // Restore dark so other tests start clean
    await page.getByRole('button', { name: /switch to dark mode/i }).click()
  })
})

test.describe('Scheduling page', () => {
  test('renders the Scheduling page stat cards', async ({ page }) => {
    const summaryStatus = async () => (await page.request.get('/api/summary')).status()
    if ((await summaryStatus()) === 404) seedDockerApiDataIfAvailable()
    await expect.poll(summaryStatus, { timeout: 20000, intervals: [500, 1000, 2000] }).toBe(200)

    await page.goto('/')
    await page.getByRole('button', { name: /scheduling/i }).click()
    await expect(page.getByRole('region', { name: /scheduling metrics/i })).toBeVisible({ timeout: 10000 })

    // Four stat cards: Makespan, Speed-up, Balance Ratio, Tests
    const section = page.getByRole('region', { name: /scheduling metrics/i })
    await expect(section.getByText(/Makespan/i)).toBeVisible()
    await expect(section.getByText(/Speed-up/i)).toBeVisible()
    await expect(section.getByText(/Balance/i).first()).toBeVisible()
  })

  test('shows the correct job count badge', async ({ page }) => {
    const summaryStatus = async () => (await page.request.get('/api/summary')).status()
    if ((await summaryStatus()) === 404) seedDockerApiDataIfAvailable()
    await expect.poll(summaryStatus, { timeout: 20000, intervals: [500, 1000, 2000] }).toBe(200)

    await page.goto('/')
    await page.getByRole('button', { name: /scheduling/i }).click()
    // Badge text looks like "2 JOBS"
    await expect(page.getByText(/\d+\s+JOBS/i)).toBeVisible({ timeout: 10000 })
  })

  test('export button is visible on the Scheduling page', async ({ page }) => {
    const summaryStatus = async () => (await page.request.get('/api/summary')).status()
    if ((await summaryStatus()) === 404) seedDockerApiDataIfAvailable()
    await expect.poll(summaryStatus, { timeout: 20000, intervals: [500, 1000, 2000] }).toBe(200)

    await page.goto('/')
    await page.getByRole('button', { name: /scheduling/i }).click()
    await expect(page.getByRole('button', { name: /export/i })).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Durations page', () => {
  test('renders the Durations page without crashing', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /durations/i }).click()
    await expect(page.getByRole('main')).toBeVisible()
    // Either real data or a friendly empty state — no unhandled crash
    const hasData = await page.getByText(/slowest tests/i).isVisible().catch(() => false)
    const hasEmptyState = await page.getByText(/no profiling data found/i).isVisible().catch(() => false)
    expect(hasData || hasEmptyState).toBe(true)
  })
})

test.describe('API error state', () => {
  test('shows an error state when the API is unreachable', async ({ page }) => {
    // Navigate directly without waiting for the API — intercept all API calls to simulate failure
    await page.route('/api/**', route => route.abort())

    await page.goto('/')
    // After aborting API calls, the overview page should show an error state rather than crashing
    await expect(page.getByText(/error|failed|unavailable|no profiling/i).first()).toBeVisible({ timeout: 15000 })
  })
})

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

  test('Instability scatter plot renders with data points', async ({ page }) => {
    const testsStatus = async () => {
      const response = await page.request.get('/api/tests?sort=cv&limit=500')
      return response.status()
    }

    if ((await testsStatus()) === 404) {
      seedDockerApiDataIfAvailable()
    }

    await expect.poll(testsStatus, { timeout: 20000, intervals: [500, 1000, 2000] }).toBe(200)

    await page.goto('/')
    await page.getByRole('button', { name: /instability/i }).click()
    await expect(page.getByText(/Duration vs Variance/i)).toBeVisible()

    const points = page.locator('.recharts-scatter .recharts-symbols, .recharts-scatter .recharts-scatter-symbol')
    await expect.poll(async () => points.count(), { timeout: 10000, intervals: [250, 500, 1000] }).toBeGreaterThan(0)
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
