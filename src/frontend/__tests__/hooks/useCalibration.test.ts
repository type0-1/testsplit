import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCalibration } from '../../src/hooks/useCalibration'

describe('useCalibration', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('starts as false', () => {
    const { result } = renderHook(() => useCalibration())
    expect(result.current).toBe(false)
  })

  it('becomes true after the default 420ms delay', () => {
    const { result } = renderHook(() => useCalibration())
    act(() => { vi.advanceTimersByTime(420) })
    expect(result.current).toBe(true)
  })

  it('does not trigger before the delay elapses', () => {
    const { result } = renderHook(() => useCalibration(200))
    act(() => { vi.advanceTimersByTime(199) })
    expect(result.current).toBe(false)
  })

  it('respects a custom delay', () => {
    const { result } = renderHook(() => useCalibration(200))
    act(() => { vi.advanceTimersByTime(200) })
    expect(result.current).toBe(true)
  })

  it('cleans up the timer on unmount', () => {
    const { result, unmount } = renderHook(() => useCalibration())
    unmount()
    act(() => { vi.advanceTimersByTime(420) })
    expect(result.current).toBe(false)
  })
})
