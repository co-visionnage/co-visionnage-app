const hasLetterPattern = /[A-Za-zА-Яа-яЁё]/;
const hasDigitPattern = /\d/;
const hasSpecialPattern = /[^A-Za-zА-Яа-яЁё0-9]/;

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Единые правила пароля для регистрации и сброса: не короче 8 символов,
 * есть буква, цифра и спецсимвол. Возвращает текст ошибки или undefined,
 * если пароль подходит.
 */
export function getPasswordProblem(password: string): string | undefined {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return 'Пароль должен быть не короче 8 символов';
  }

  if (
    !hasLetterPattern.test(password) ||
    !hasDigitPattern.test(password) ||
    !hasSpecialPattern.test(password)
  ) {
    return 'Пароль должен содержать буквы, цифры и хотя бы один спецсимвол';
  }

  return undefined;
}
