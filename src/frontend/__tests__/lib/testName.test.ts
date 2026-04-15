import { describe, it, expect } from 'vitest'
import { testMethodName, testClassName } from '../../src/lib/testName'

describe('testMethodName', () => {
  it('returns the last segment after the final dot', () => {
    expect(testMethodName('com.example.MyTest.shouldPass')).toBe('shouldPass')
  })

  it('returns the full string when there is no dot', () => {
    expect(testMethodName('shouldPass')).toBe('shouldPass')
  })

  it('handles a single dot', () => {
    expect(testMethodName('MyTest.shouldFail')).toBe('shouldFail')
  })
})

describe('testClassName', () => {
  it('returns everything before the last dot', () => {
    expect(testClassName('com.example.MyTest.shouldPass')).toBe('com.example.MyTest')
  })

  it('returns empty string when there is no dot', () => {
    expect(testClassName('shouldPass')).toBe('')
  })

  it('returns the prefix before a single dot', () => {
    expect(testClassName('MyTest.shouldFail')).toBe('MyTest')
  })
})
