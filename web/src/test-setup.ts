import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, expect } from 'vitest';
import * as axeMatchers from 'vitest-axe/matchers';

// Vitest globals are off, so Testing Library does not clean up the DOM by itself.
afterEach(() => {
  cleanup();
});

expect.extend(axeMatchers);
