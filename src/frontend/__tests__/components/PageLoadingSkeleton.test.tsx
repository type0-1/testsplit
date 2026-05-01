import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageLoadingSkeleton } from '../../src/components/PageLoadingSkeleton'

describe('PageLoadingSkeleton', () => {
  it('renders with the provided title', () => {
    render(<PageLoadingSkeleton title="Scheduling" accentColor="var(--cyan)" />)
    expect(screen.getByText('Scheduling')).toBeInTheDocument()
  })

  it('has an accessible loading label containing the page title', () => {
    render(<PageLoadingSkeleton title="Durations" accentColor="var(--orange)" />)
    expect(screen.getByLabelText(/Durations loading/i)).toBeInTheDocument()
  })

  it('renders without crashing for any valid title and accent color', () => {
    const { container } = render(
      <PageLoadingSkeleton title="Instability" accentColor="var(--red)" />,
    )
    expect(container.firstChild).toBeTruthy()
  })
})
