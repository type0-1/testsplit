import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme } from '../../src/hooks/useTheme'

describe('useTheme', () => {
  beforeEach(() => {
    // Always start each test with a clean slate
    localStorage.clear()
    document.documentElement.classList.remove('light')
  })

  afterEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('light')
  })

  it('defaults to dark theme when localStorage is empty', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
  })

  it('does not add the light class when theme is dark', () => {
    renderHook(() => useTheme())
    expect(document.documentElement.classList.contains('light')).toBe(false)
  })

  it('restores a persisted light theme from localStorage', () => {
    localStorage.setItem('testsplit-theme', 'light')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })

  it('toggle switches from dark to light and adds the class', () => {
    const { result } = renderHook(() => useTheme())
    act(() => { result.current.toggle() })
    expect(result.current.theme).toBe('light')
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })

  it('toggle switches from light back to dark and removes the class', () => {
    localStorage.setItem('testsplit-theme', 'light')
    const { result } = renderHook(() => useTheme())
    act(() => { result.current.toggle() })
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.classList.contains('light')).toBe(false)
  })

  it('persists the new theme to localStorage after toggle', () => {
    const { result } = renderHook(() => useTheme())
    act(() => { result.current.toggle() })
    expect(localStorage.getItem('testsplit-theme')).toBe('light')
  })
})
