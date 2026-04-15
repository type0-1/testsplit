import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageHeader } from '../../src/components/PageHeader'

describe('PageHeader', () => {
  it('renders the title', () => {
    render(<PageHeader title="DURATIONS" accent="var(--cyan)" subtitle="test distribution" />)
    expect(screen.getByText('DURATIONS')).toBeInTheDocument()
  })

  it('renders the subtitle', () => {
    render(<PageHeader title="DURATIONS" accent="var(--cyan)" subtitle="test distribution" />)
    expect(screen.getByText('test distribution')).toBeInTheDocument()
  })

  it('renders the accent separator', () => {
    render(<PageHeader title="DURATIONS" accent="var(--cyan)" subtitle="test distribution" />)
    expect(screen.getByText('/')).toBeInTheDocument()
  })

  it('renders the right slot when provided', () => {
    render(
      <PageHeader title="X" accent="" subtitle="y" right={<button>Export</button>} />
    )
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument()
  })

  it('does not render a right slot container when omitted', () => {
    const { container } = render(<PageHeader title="X" accent="" subtitle="y" />)
    expect(container.querySelectorAll('header > div')).toHaveLength(1)
  })
})
