import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { postJson } from '@/shared/lib/postJson';
import { EmailVerificationBanner } from './EmailVerificationBanner';

vi.mock('@/shared/lib/postJson', () => ({ postJson: vi.fn() }));

describe('EmailVerificationBanner', () => {
  beforeEach(() => {
    vi.mocked(postJson).mockReset();
  });

  it('names the unconfirmed address', () => {
    render(<EmailVerificationBanner email='anna@example.com' />);

    expect(
      screen.getByRole('region', { name: 'Подтверждение email' }),
    ).toHaveTextContent('anna@example.com не подтверждён');
  });

  it('resends the letter and replaces the button with a confirmation', async () => {
    vi.mocked(postJson).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<EmailVerificationBanner email='anna@example.com' />);

    await user.click(screen.getByRole('button', { name: 'Отправить ещё раз' }));

    expect(postJson).toHaveBeenCalledWith('/api/v1/auth/verify-email/resend');
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Письмо отправлено',
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows the error (for example the rate limit) and keeps the button for a later retry', async () => {
    vi.mocked(postJson).mockResolvedValue({
      ok: false,
      error: 'Письмо уже отправлялось недавно. Попробуйте позже.',
    });
    const user = userEvent.setup();
    render(<EmailVerificationBanner email='anna@example.com' />);

    await user.click(screen.getByRole('button', { name: 'Отправить ещё раз' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Письмо уже отправлялось недавно',
    );
    expect(
      screen.getByRole('button', { name: 'Отправить ещё раз' }),
    ).toBeEnabled();
  });
});
