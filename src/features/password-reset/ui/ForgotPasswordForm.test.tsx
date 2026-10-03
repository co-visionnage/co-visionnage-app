import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { postJson } from '@/shared/lib/postJson';
import { ForgotPasswordForm } from './ForgotPasswordForm';

vi.mock('@/shared/lib/postJson', () => ({ postJson: vi.fn() }));

describe('ForgotPasswordForm', () => {
  beforeEach(() => {
    vi.mocked(postJson).mockReset();
  });

  it('sends the typed email and then shows a message that does not reveal whether the account exists', async () => {
    vi.mocked(postJson).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText('Email'), 'anna@example.com');
    await user.click(screen.getByRole('button', { name: 'Отправить ссылку' }));

    expect(postJson).toHaveBeenCalledWith(
      '/api/v1/auth/password-reset/request',
      {
        email: 'anna@example.com',
      },
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Если аккаунт с адресом anna@example.com существует',
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows the error from the server and keeps the form so the user can retry', async () => {
    vi.mocked(postJson).mockResolvedValue({
      ok: false,
      error: 'Слишком много попыток. Попробуйте позже.',
    });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText('Email'), 'anna@example.com');
    await user.click(screen.getByRole('button', { name: 'Отправить ссылку' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Слишком много попыток',
    );
    expect(screen.getByLabelText('Email')).toHaveValue('anna@example.com');
    expect(
      screen.getByRole('button', { name: 'Отправить ссылку' }),
    ).toBeEnabled();
  });

  it('disables the button while the request is in flight', async () => {
    const pending = Promise.withResolvers<{ ok: true }>();
    vi.mocked(postJson).mockReturnValue(pending.promise);
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText('Email'), 'anna@example.com');
    await user.click(screen.getByRole('button', { name: 'Отправить ссылку' }));

    expect(
      screen.getByRole('button', { name: 'Отправляем...' }),
    ).toBeDisabled();

    pending.resolve({ ok: true });
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
  });
});
