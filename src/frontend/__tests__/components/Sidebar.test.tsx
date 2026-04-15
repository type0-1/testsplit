import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sidebar } from '../../src/components/Sidebar'
import type { Page } from '../../src/components/Sidebar'

describe('Sidebar', () => {
  it('renders all four nav items', () => {
    render(<Sidebar page="overview" onNavigate={vi.fn()} />)
    expect(screen.getByRole('button', { name: /overview/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /durations/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /scheduling/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /instability/i })).toBeInTheDocument()
  })

  it('marks the active page with aria-current="page"', () => {
    render(<Sidebar page="durations" onNavigate={vi.fn()} />)
    expect(screen.getByRole('button', { name: /durations/i })).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark inactive pages with aria-current', () => {
    render(<Sidebar page="durations" onNavigate={vi.fn()} />)
    expect(screen.getByRole('button', { name: /overview/i })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: /scheduling/i })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: /instability/i })).not.toHaveAttribute('aria-current')
  })

  it('calls onNavigate with the correct page id when a nav item is clicked', async () => {
    const onNavigate = vi.fn()
    render(<Sidebar page="overview" onNavigate={onNavigate} />)
    await userEvent.click(screen.getByRole('button', { name: /scheduling/i }))
    expect(onNavigate).toHaveBeenCalledWith('scheduling' satisfies Page)
  })

  it('renders the TestSplit brand mark', () => {
    render(<Sidebar page="overview" onNavigate={vi.fn()} />)
    expect(screen.getByText('TestSplit')).toBeInTheDocument()
  })
})
