import { describe, expect, it } from 'vitest';

import { getPasswordProblem } from './password';

describe('getPasswordProblem', () => {
  it('accepts a password with letters, digits and a special character', () => {
    expect(getPasswordProblem('correct-horse-1!')).toBeUndefined();
    expect(getPasswordProblem('Пароль-2024')).toBeUndefined();
  });

  it('rejects passwords shorter than 8 characters first', () => {
    expect(getPasswordProblem('a1!')).toBe(
      'Пароль должен быть не короче 8 символов',
    );
    expect(getPasswordProblem('')).toBe(
      'Пароль должен быть не короче 8 символов',
    );
  });

  it('rejects long passwords missing a letter, a digit or a special character', () => {
    const expected =
      'Пароль должен содержать буквы, цифры и хотя бы один спецсимвол';

    expect(getPasswordProblem('12345678!')).toBe(expected);
    expect(getPasswordProblem('abcdefgh!')).toBe(expected);
    expect(getPasswordProblem('abcdefg12')).toBe(expected);
  });
});
