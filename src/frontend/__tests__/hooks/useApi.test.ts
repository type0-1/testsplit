import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import React from 'react'
import { useApi } from '../../src/hooks/useApi'

// Give every test its own SWR cache so keys don't bleed across tests
const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(SWRConfig, { value: { provider: () => new Map() } }, children)

describe('useApi', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('returns loading=true and data=null initially', () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {})) // never resolves
    const { result } = renderHook(() => useApi('/api/test'), { wrapper })
    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('returns data on a successful response', async () => {
    const payload = { value: 421231 }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }))
    const { result } = renderHook(() => useApi<typeof payload>('/api/test'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual(payload)
    expect(result.current.error).toBeNull()
  })

  it('returns an error message on a non-ok response with an error body', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'not found' }), { status: 404 })
    )
    const { result } = renderHook(() => useApi('/api/test'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('not found')
    expect(result.current.data).toBeNull()
  })

  it('falls back to HTTP status when the error body has no error field', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 500 }))
    const { result } = renderHook(() => useApi('/api/test'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('HTTP 500')
  })
})
