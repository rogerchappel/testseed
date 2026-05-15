export class TestSeedError extends Error {
  constructor(message: string, public readonly code = 'TESTSEED_ERROR') {
    super(message);
    this.name = 'TestSeedError';
  }
}

export function fail(message: string, code?: string): never {
  throw new TestSeedError(message, code);
}
