import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchJson } from '@/shared/lib/fetchJson';
import { UnsubscribeConfirm } from './UnsubscribeConfirm';

vi.mock('@/shared/lib/fetchJson', () => ({ fetchJson: vi.fn() }));

describe('UnsubscribeConfirm', () => {
  beforeEach(() => {
    vi.mocked(fetchJson).mockReset();
  });

  it('does nothing on open: unsubscribing needs an explicit click', () => {
    render(<UnsubscribeConfirm token='tok' />);

    expect(fetchJson).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Отписаться' })).toBeEnabled();
  });

  it('posts the token on click and names the category', async () => {
    vi.mocked(fetchJson).mockResolvedValue({
      ok: true,
      data: { category: 'series_added' },
    });
    const user = userEvent.setup();
    render(<UnsubscribeConfirm token='tok' />);

    await user.click(screen.getByRole('button', { name: 'Отписаться' }));

    expect(fetchJson).toHaveBeenCalledWith('/api/v1/unsubscribe', {
      method: 'POST',
      body: { token: 'tok' },
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Новый сериал в списке',
    );
  });

  it('shows the API error for a bad token', async () => {
    vi.mocked(fetchJson).mockResolvedValue({
      ok: false,
      status: 400,
      error: 'ссылка недействительна',
    });
    const user = userEvent.setup();
    render(<UnsubscribeConfirm token='bad' />);

    await user.click(screen.getByRole('button', { name: 'Отписаться' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'ссылка недействительна',
    );
  });

  it('explains a missing token instead of showing a dead button', () => {
    render(<UnsubscribeConfirm />);

    expect(screen.getByRole('alert')).toHaveTextContent('нет кода отписки');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
