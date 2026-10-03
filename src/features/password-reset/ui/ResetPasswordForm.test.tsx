import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { postJson } from '@/shared/lib/postJson';
import { ResetPasswordForm } from './ResetPasswordForm';

vi.mock('@/shared/lib/postJson', () => ({ postJson: vi.fn() }));

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  password: string,
  confirmation: string,
) {
  await user.type(screen.getByLabelText('Новый пароль'), password);
  await user.type(screen.getByLabelText('Подтверждение пароля'), confirmation);
  await user.click(screen.getByRole('button', { name: 'Сохранить пароль' }));
}

describe('ResetPasswordForm', () => {
  beforeEach(() => {
    vi.mocked(postJson).mockReset();
  });

  it('sends the token with both passwords and then asks the user to sign in again', async () => {
    vi.mocked(postJson).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ResetPasswordForm token='abc123' />);

    await fillAndSubmit(user, 'brand-new-pass-9!', 'brand-new-pass-9!');

    expect(postJson).toHaveBeenCalledWith(
      '/api/v1/auth/password-reset/confirm',
      {
        token: 'abc123',
        newPassword: 'brand-new-pass-9!',
        confirmPassword: 'brand-new-pass-9!',
      },
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Пароль изменён',
    );
    expect(screen.getByRole('link', { name: 'Войти' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('rejects a weak password locally, without calling the server', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm token='abc123' />);

    await fillAndSubmit(user, 'abcdefgh', 'abcdefgh');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Пароль должен содержать буквы, цифры и хотя бы один спецсимвол',
    );
    expect(postJson).not.toHaveBeenCalled();
  });

  it('rejects mismatching confirmation locally', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm token='abc123' />);

    await fillAndSubmit(user, 'brand-new-pass-9!', 'brand-new-pass-8!');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Пароль и подтверждение не совпадают',
    );
    expect(postJson).not.toHaveBeenCalled();
  });

  it('shows the server error for an expired link and lets the user retry', async () => {
    vi.mocked(postJson).mockResolvedValue({
      ok: false,
      error: 'Ссылка недействительна или истекла. Запросите новую.',
    });
    const user = userEvent.setup();
    render(<ResetPasswordForm token='abc123' />);

    await fillAndSubmit(user, 'brand-new-pass-9!', 'brand-new-pass-9!');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ссылка недействительна или истекла',
    );
    expect(
      screen.getByRole('button', { name: 'Сохранить пароль' }),
    ).toBeEnabled();
  });

  it('without a token it offers to request a new link instead of showing a form', () => {
    render(<ResetPasswordForm />);

    expect(screen.queryByLabelText('Новый пароль')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Запросить новую ссылку' }),
    ).toHaveAttribute('href', '/forgot-password');
  });
});
