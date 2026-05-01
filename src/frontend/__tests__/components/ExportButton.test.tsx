import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExportButton } from '../../src/components/ExportButton'

describe('ExportButton', () => {
  it('renders with the EXPORT label', () => {
    render(<ExportButton onClick={vi.fn()} />)
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
  })

  it('calls the onClick handler when clicked', async () => {
    const onClick = vi.fn()
    render(<ExportButton onClick={onClick} />)
    await userEvent.click(screen.getByRole('button', { name: /export/i }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not call onClick when rendered but not clicked', () => {
    const onClick = vi.fn()
    render(<ExportButton onClick={onClick} />)
    expect(onClick).not.toHaveBeenCalled()
  })
})
