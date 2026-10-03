import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { postJson } from '@/shared/lib/postJson';
import { VerifyEmailStatus } from './VerifyEmailStatus';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));
vi.mock('@/shared/lib/postJson', () => ({ postJson: vi.fn() }));

describe('VerifyEmailStatus', () => {
  beforeEach(() => {
    vi.mocked(postJson).mockReset();
    refresh.mockReset();
  });

  it('verifies the token on open, confirms it and refreshes the page data', async () => {
    vi.mocked(postJson).mockResolvedValue({ ok: true });
    render(<VerifyEmailStatus token='tok-1' />);

    expect(
      await screen.findByText('Email подтверждён. Спасибо!'),
    ).toBeInTheDocument();
    expect(postJson).toHaveBeenCalledTimes(1);
    expect(postJson).toHaveBeenCalledWith('/api/v1/auth/verify-email', {
      token: 'tok-1',
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('shows a progress message while the request is pending', () => {
    vi.mocked(postJson).mockReturnValue(new Promise(() => {}));
    render(<VerifyEmailStatus token='tok-1' />);

    expect(screen.getByRole('status')).toHaveTextContent('Подтверждаем email');
  });

  it('shows the server error for an invalid or used link', async () => {
    vi.mocked(postJson).mockResolvedValue({
      ok: false,
      error: 'Ссылка недействительна или истекла. Запросите новую.',
    });
    render(<VerifyEmailStatus token='tok-1' />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ссылка недействительна или истекла',
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it('does not call the server when the link has no token', () => {
    render(<VerifyEmailStatus />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'В ссылке нет кода подтверждения',
    );
    expect(postJson).not.toHaveBeenCalled();
  });
});
