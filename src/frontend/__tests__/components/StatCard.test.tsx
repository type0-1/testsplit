import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatCard } from '../../src/components/StatCard'

/**
 * Mock useCountUp to (since jsdom doesn't support the requestAnimationFrame loop in useCountUp)
 * return the target value directly so StatCard renders the formatted final value
 */

vi.mock('../../src/hooks/useCountUp', () => ({
  useCountUp: (target: number) => target,
}))

const baseProps = {
  label: 'MAKESPAN',
  value: 42,
  format: (v: number) => `${v.toFixed(0)}s`,
  sub: '4 jobs',
  accent: 'var(--cyan)',
  active: true,
  delay: 0,
}

describe('StatCard', () => {
  it('renders the label', () => {
    render(<StatCard {...baseProps} />)
    expect(screen.getByText('MAKESPAN')).toBeInTheDocument()
  })

  it('renders the formatted value', () => {
    render(<StatCard {...baseProps} />)
    expect(screen.getByText('42s')).toBeInTheDocument()
  })

  it('renders the sub text', () => {
    render(<StatCard {...baseProps} />)
    expect(screen.getByText('4 jobs')).toBeInTheDocument()
  })

  it('renders an up arrow and percentage for a positive delta', () => {
    render(<StatCard {...baseProps} delta={0.15} />)
    expect(screen.getByText(/↑/)).toBeInTheDocument()
    expect(screen.getByText(/15\.0%/)).toBeInTheDocument()
  })

  it('renders a down arrow for a negative delta', () => {
    render(<StatCard {...baseProps} delta={-0.08} />)
    expect(screen.getByText(/↓/)).toBeInTheDocument()
  })

  it('renders no delta indicator when delta is null', () => {
    render(<StatCard {...baseProps} delta={null} />)
    expect(screen.queryByText(/↑|↓|→/)).toBeNull()
  })

  it('renders no delta indicator when delta is omitted', () => {
    render(<StatCard {...baseProps} />)
    expect(screen.queryByText(/↑|↓|→/)).toBeNull()
  })
})
