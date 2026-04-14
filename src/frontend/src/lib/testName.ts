export function testMethodName(testName: string): string {
  return testName.split('.').pop() ?? testName
}

export function testClassName(testName: string): string {
  return testName.includes('.') ? testName.substring(0, testName.lastIndexOf('.')) : ''
}
