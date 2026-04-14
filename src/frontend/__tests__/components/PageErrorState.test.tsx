import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageErrorState } from '../../src/components/PageErrorState'

describe('PageErrorState', () => {
  it('renders the page title', () => {
    render(<PageErrorState title="DURATIONS" error="Network error" />)
    expect(screen.getByText('DURATIONS')).toBeInTheDocument()
  })

  it('renders the error message', () => {
    render(<PageErrorState title="DURATIONS" error="Network error" />)
    expect(screen.getByText('Network error')).toBeInTheDocument()
  })

  it('renders the alert with assertive aria-live', () => {
    render(<PageErrorState title="DURATIONS" error="Network error" />)
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive')
  })

  it('sets aria-label on the container using the title', () => {
    const { container } = render(<PageErrorState title="DURATIONS" error="oops" />)
    expect(container.firstChild).toHaveAttribute('aria-label', 'DURATIONS error')
  })
})
