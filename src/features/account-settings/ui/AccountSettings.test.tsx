import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchJson } from '@/shared/lib/fetchJson';
import { ActiveSessions } from './ActiveSessions';
import { ChangePasswordForm } from './ChangePasswordForm';
import { NotificationPreferences } from './NotificationPreferences';
import { describeUserAgent } from './userAgent';

vi.mock('@/shared/lib/fetchJson', () => ({ fetchJson: vi.fn() }));

const mocked = vi.mocked(fetchJson);

beforeEach(() => {
  mocked.mockReset();
});

describe('describeUserAgent', () => {
  it('shortens a User-Agent to browser and system', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      ),
    ).toBe('Chrome · Windows');
    expect(describeUserAgent()).toBe('Неизвестное устройство');
  });
});

async function fillPasswordForm(
  user: ReturnType<typeof userEvent.setup>,
  next: string,
) {
  await user.type(screen.getByLabelText('Текущий пароль'), 'old-pass-1!');
  await user.type(screen.getByLabelText('Новый пароль'), next);
  await user.type(screen.getByLabelText('Подтверждение пароля'), next);
  await user.click(screen.getByRole('button', { name: 'Сменить пароль' }));
}

describe('ChangePasswordForm', () => {
  it('rejects a weak password without calling the API', async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await fillPasswordForm(user, 'short');

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(mocked).not.toHaveBeenCalled();
  });

  it('sends all three fields and confirms', async () => {
    mocked.mockResolvedValue({ ok: true, data: undefined });
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await fillPasswordForm(user, 'brand-new-pass-9!');

    expect(mocked).toHaveBeenCalledWith('/api/v1/auth/password/change', {
      method: 'POST',
      body: {
        currentPassword: 'old-pass-1!',
        newPassword: 'brand-new-pass-9!',
        confirmPassword: 'brand-new-pass-9!',
      },
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Пароль изменён',
    );
  });

  it('shows the API error (for example a wrong current password)', async () => {
    mocked.mockResolvedValue({
      ok: false,
      status: 400,
      error: 'неверный текущий пароль',
    });
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await fillPasswordForm(user, 'brand-new-pass-9!');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'неверный текущий пароль',
    );
  });
});

describe('ActiveSessions', () => {
  const sessions = [
    {
      id: 'current',
      current: true,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36',
      createdAt: '2026-01-01T00:00:00Z',
      lastSeenAt: '2026-01-02T00:00:00Z',
    },
    {
      id: 'other',
      current: false,
      userAgent:
        'Mozilla/5.0 (Linux; Android 14) Chrome/120.0 Mobile Safari/537.36',
      createdAt: '2026-01-01T00:00:00Z',
      lastSeenAt: '2026-01-02T00:00:00Z',
    },
  ];

  it('lists sessions, marks the current one and revokes another', async () => {
    mocked.mockResolvedValueOnce({ ok: true, data: { sessions } });
    mocked.mockResolvedValueOnce({ ok: true, data: undefined });
    mocked.mockResolvedValueOnce({
      ok: true,
      data: { sessions: [sessions[0]] },
    });
    const user = userEvent.setup();
    render(<ActiveSessions />);

    expect(await screen.findAllByTestId('session-row')).toHaveLength(2);
    expect(screen.getByText('Это устройство')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Закрыть' }));

    expect(mocked).toHaveBeenCalledWith('/api/v1/auth/sessions/other', {
      method: 'DELETE',
    });
    await waitFor(() =>
      expect(screen.getAllByTestId('session-row')).toHaveLength(1),
    );
  });
});

describe('NotificationPreferences', () => {
  it('saves the whole matrix after a toggle', async () => {
    mocked.mockResolvedValueOnce({
      ok: true,
      data: {
        preferences: [
          {
            category: 'series_added',
            push: true,
            email: true,
            emailSupported: true,
          },
          { category: 'poll', push: true, email: false, emailSupported: false },
        ],
      },
    });
    mocked.mockResolvedValueOnce({ ok: true, data: undefined });
    const user = userEvent.setup();
    render(<NotificationPreferences />);

    await user.click(
      await screen.findByLabelText('Новый сериал в списке: почта'),
    );
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(mocked).toHaveBeenLastCalledWith(
      '/api/v1/notification-preferences',
      {
        method: 'PUT',
        body: {
          preferences: [
            { category: 'series_added', push: true, email: false },
            { category: 'poll', push: true, email: false },
          ],
        },
      },
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Сохранено');
  });

  it('disables the email switch for events that send no letters', async () => {
    mocked.mockResolvedValueOnce({
      ok: true,
      data: {
        preferences: [
          { category: 'poll', push: true, email: false, emailSupported: false },
        ],
      },
    });
    render(<NotificationPreferences />);

    expect(await screen.findByLabelText('Голосования: почта')).toBeDisabled();
  });
});
