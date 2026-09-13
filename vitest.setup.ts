import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Without `test.globals: true` in vitest.config.ts, Testing Library's own
// automatic per-test cleanup never registers, so each render() left its DOM
// in place for the next test in the same file -- queries like getByText
// would then match leftover nodes from earlier tests instead of failing or
// resolving uniquely.
afterEach(() => {
  cleanup();
});
