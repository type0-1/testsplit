import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '../../src/components/StatusBadge'

describe('StatusBadge', () => {
  it('renders OUTLIER label', () => {
    render(<StatusBadge status="outlier" />)
    expect(screen.getByText('OUTLIER')).toBeInTheDocument()
  })

  it('renders UNSTABLE label', () => {
    render(<StatusBadge status="unstable" />)
    expect(screen.getByText('UNSTABLE')).toBeInTheDocument()
  })

  it('renders CRITICAL label', () => {
    render(<StatusBadge status="critical" />)
    expect(screen.getByText('CRITICAL')).toBeInTheDocument()
  })

  it('applies orange colour for outlier', () => {
    render(<StatusBadge status="outlier" />)
    const badge = screen.getByText('OUTLIER')
    expect(badge).toHaveStyle({ color: 'var(--orange)' })
  })

  it('applies amber colour for unstable', () => {
    render(<StatusBadge status="unstable" />)
    const badge = screen.getByText('UNSTABLE')
    expect(badge).toHaveStyle({ color: 'var(--amber)' })
  })
})
