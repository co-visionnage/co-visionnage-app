import { cache } from 'react';

import { ApiError, apiJson } from './server';

export type SessionUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
};

type ProfileDto = {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
};

// Wrapped in React's per-request cache: one render may ask for the current
// user from the page, its loaders and several actions, but the API should
// see a single /users/me per request.
export const getCurrentUser = cache(
  async (): Promise<SessionUser | undefined> => {
    try {
      const profile = await apiJson<ProfileDto>('/users/me');

      return {
        id: profile.id,
        email: profile.email,
        emailVerified: profile.emailVerified,
        displayName: profile.displayName || undefined,
      };
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return;
      throw error;
    }
  },
);

export async function requireCurrentUser(): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('UNAUTHORIZED');
  }

  return user;
}
