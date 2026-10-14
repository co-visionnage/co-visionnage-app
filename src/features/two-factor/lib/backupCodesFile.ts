export const BACKUP_CODES_FILENAME = 'notrecinema-backup-codes.txt';

const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * Text of the file with backup codes: what they are, how they work and the
 * codes themselves, one per line. Plain text opens anywhere and prints well.
 */
export function backupCodesFileContent(codes: string[], issuedAt: Date) {
  return [
    'notrecinema: резервные коды двухфакторной аутентификации',
    `Выданы ${dateFormat.format(issuedAt)}`,
    '',
    'Каждый код подходит один раз вместо кода из приложения-аутентификатора,',
    'если телефон потерян. Храните файл отдельно от пароля: например, в',
    'менеджере паролей или распечатанным в надёжном месте.',
    'Новый набор можно выпустить в настройках, старые коды при этом',
    'перестанут действовать.',
    '',
    ...codes.map((code, index) => `${index + 1}. ${code}`),
    '',
  ].join('\n');
}

/** Hands the text to the browser as a file download. */
export function downloadTextFile(content: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: 'text/plain;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
