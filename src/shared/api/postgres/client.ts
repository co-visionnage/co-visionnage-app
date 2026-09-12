import type { ImportedSeries } from '@/shared/lib/importSeries/types';

import {
  AuthMode,
  FamilyAchievements,
  FamilyMember,
  FamilyStats,
  Recommendation,
  SeriesComment,
  SeriesProgress,
  SeriesReaction,
  SeriesStatus,
  WatchHistoryEntry,
  WatchPoll,
  YearWrapped,
} from '@/shared/types';

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

        return readJson<{
          success: true;
          requiresTwoFactor?: boolean;
          userId?: string;
        }>(response);
      },
      async verifyTwoFactor(userId: string, code: string) {
        const response = await fetch('/api/auth/verify-2fa', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId, code }),
        });

        return readJson<{ success: true }>(response);
      },
      async getTwoFactorStatus() {
        const response = await fetch('/api/auth/2fa-status', {
          cache: 'no-store',
        });

        return readJson<{ enabled: boolean }>(response);
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
    async getSeriesComments(seriesId: string) {
      const response = await fetch(`/api/series/${seriesId}/comments`, {
        cache: 'no-store',
      });

      return readJson<{ comments: SeriesComment[] }>(response);
    },
    async getSeriesReactions(seriesId: string) {
      const response = await fetch(`/api/series/${seriesId}/reactions`, {
        cache: 'no-store',
      });

      return readJson<{ reactions: SeriesReaction[] }>(response);
    },
    async getSeriesProgress(seriesId: string) {
      const response = await fetch(`/api/series/${seriesId}/progress`, {
        cache: 'no-store',
      });

      return readJson<{ progress: SeriesProgress[] }>(response);
    },
    async getFamilyStats(familyId: string) {
      const response = await fetch(`/api/family/stats?familyId=${familyId}`, {
        cache: 'no-store',
      });

      return readJson<{ stats: FamilyStats }>(response);
    },
    async getFamilyAchievements(familyId: string) {
      const response = await fetch(
        `/api/family/achievements?familyId=${familyId}`,
        { cache: 'no-store' },
      );

      return readJson<{ achievements: FamilyAchievements }>(response);
    },
    async getYearWrapped(familyId: string, year: number) {
      const response = await fetch(
        `/api/family/wrapped?familyId=${familyId}&year=${year}`,
        { cache: 'no-store' },
      );

      return readJson<{ wrapped: YearWrapped }>(response);
    },
    async getRecommendations(familyId: string) {
      const response = await fetch(
        `/api/family/recommendations?familyId=${familyId}`,
        { cache: 'no-store' },
      );

      return readJson<{ recommendations: Recommendation[] }>(response);
    },
    async getWatchHistory(familyId: string) {
      const response = await fetch(`/api/family/history?familyId=${familyId}`, {
        cache: 'no-store',
      });

      return readJson<{ history: WatchHistoryEntry[] }>(response);
    },
    async searchImport(query: string) {
      const response = await fetch(
        `/api/import/search?query=${encodeURIComponent(query)}`,
        { cache: 'no-store' },
      );

      return readJson<{ results: ImportedSeries[] }>(response);
    },
    async getFamilyWatchPolls(familyId: string) {
      const response = await fetch(`/api/family/polls?familyId=${familyId}`, {
        cache: 'no-store',
      });

      return readJson<{ polls: WatchPoll[] }>(response);
    },
  };
}
