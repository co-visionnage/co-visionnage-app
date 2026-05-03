import { AuthMode, FamilyMember, SeriesStatus } from '@/shared/types';

type LoginPayload = {
  mode?: AuthMode;
  provider?: 'email' | 'github';
  email?: string;
  displayName?: string;
  password?: string;
  confirmPassword?: string;
  legalAccepted?: boolean;
};

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => {})) as {
      error?: string;
    } | null;
    throw new Error(errorPayload?.error ?? 'Request failed');
  }

  return response.json() as Promise<T>;
}

export function createClient() {
  return {
    auth: {
      async login(payload: LoginPayload) {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        return readJson<{ success: true }>(response);
      },
      startGitHubLogin(legalAccepted: boolean) {
        const searchParameters = new URLSearchParams({
          legalAccepted: String(legalAccepted),
        });
        globalThis.location.href = `/api/auth/github/start?${searchParameters.toString()}`;
      },
      async logout() {
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
        });

        return readJson<{ success: true }>(response);
      },
    },
    async getFamilySeries(familyId: string) {
      const response = await fetch(`/api/series?familyId=${familyId}`, {
        cache: 'no-store',
      });

      return readJson<{
        series: Array<{
          id: string;
          title: string;
          genres: string[];
          year: number;
          image_url?: string | null;
          status: SeriesStatus;
          rating?: number;
          comment?: string;
        }>;
      }>(response);
    },
    async getFamilyMembers(familyId: string) {
      const response = await fetch(`/api/family/members?familyId=${familyId}`, {
        cache: 'no-store',
      });

      return readJson<{ members: FamilyMember[] }>(response);
    },
    async removeFamilyMember(familyId: string, memberUserId: string) {
      const response = await fetch('/api/family/members', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ familyId, memberUserId }),
      });

      return readJson<{ success: true }>(response);
    },
  };
}
