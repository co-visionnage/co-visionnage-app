import { describe, expect, it } from 'vitest';

import { cn } from './utils';

describe('cn', () => {
  it('joins plain class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, '', 'b')).toBe('a b');
  });

  it('resolves conflicting Tailwind utilities to the last one', () => {
    // this is the entire reason cn exists over a plain clsx -- without
    // tailwind-merge, both classes would remain and the resulting style
    // would be whichever CSS rule happens to come later in the stylesheet.
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('supports the conditional-object form', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active');
  });
});
