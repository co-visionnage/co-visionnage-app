import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setSeriesProgressAction } from '@/shared/actions/progress-postgres';
import { Series, SeriesProgress } from '@/shared/types';
import { EpisodeProgressControl } from './EpisodeProgressControl';

vi.mock('@/shared/actions/progress-postgres', () => ({
  setSeriesProgressAction: vi.fn().mockResolvedValue({ success: true }),
}));

const series: Series = {
  id: 'series-1',
  title: 'Breaking Bad',
  genres: [],
  year: 2008,
  status: 'to-watch',
  totalSeasons: 5,
  totalEpisodes: 62,
} as unknown as Series;

describe('EpisodeProgressControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows 0 progress and the current season when there is no progress yet', () => {
    render(
      <EpisodeProgressControl
        progress={[]}
        series={series}
        onProgressChange={vi.fn()}
      />,
    );

    expect(screen.getByText('0/62')).toBeInTheDocument();
    expect(screen.getByText('Прогресс · сезон 1')).toBeInTheDocument();
  });

  it("renders the current user's own progress, not another member's", () => {
    const progress: SeriesProgress[] = [
      {
        seriesId: 'series-1',
        userId: 'other-user',
        displayName: 'Alice',
        currentSeason: 3,
        currentEpisode: 10,
        updatedAt: new Date().toISOString(),
        isMine: false,
      },
      {
        seriesId: 'series-1',
        userId: 'me',
        displayName: 'Me',
        currentSeason: 2,
        currentEpisode: 5,
        updatedAt: new Date().toISOString(),
        isMine: true,
      },
    ];

    render(
      <EpisodeProgressControl
        progress={progress}
        series={series}
        onProgressChange={vi.fn()}
      />,
    );

    expect(screen.getByText('5/62')).toBeInTheDocument();
    expect(screen.getByText('Прогресс · сезон 2')).toBeInTheDocument();
  });

  it("shows other members' progress as a summary line", () => {
    const progress: SeriesProgress[] = [
      {
        seriesId: 'series-1',
        userId: 'other-user',
        displayName: 'Alice',
        currentSeason: 3,
        currentEpisode: 10,
        updatedAt: new Date().toISOString(),
        isMine: false,
      },
    ];

    render(
      <EpisodeProgressControl
        progress={progress}
        series={series}
        onProgressChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Alice: с3 э10')).toBeInTheDocument();
  });

  it('disables the decrement button at episode 0', () => {
    render(
      <EpisodeProgressControl
        progress={[]}
        series={series}
        onProgressChange={vi.fn()}
      />,
    );

    const [decrement] = screen.getAllByRole('button');
    expect(decrement).toBeDisabled();
  });

  it('saves an incremented episode and notifies the parent to refresh', async () => {
    const onProgressChange = vi.fn();
    render(
      <EpisodeProgressControl
        progress={[]}
        series={series}
        onProgressChange={onProgressChange}
      />,
    );

    const [, increment] = screen.getAllByRole('button');
    fireEvent.click(increment);

    await vi.waitFor(() => {
      expect(setSeriesProgressAction).toHaveBeenCalledWith('series-1', 1, 1);
    });
    await vi.waitFor(() => {
      expect(onProgressChange).toHaveBeenCalledTimes(1);
    });
  });

  it('does not increment past totalEpisodes', () => {
    const progress: SeriesProgress[] = [
      {
        seriesId: 'series-1',
        userId: 'me',
        displayName: 'Me',
        currentSeason: 5,
        currentEpisode: 62,
        updatedAt: new Date().toISOString(),
        isMine: true,
      },
    ];

    render(
      <EpisodeProgressControl
        progress={progress}
        series={series}
        onProgressChange={vi.fn()}
      />,
    );

    const [, increment] = screen.getAllByRole('button');
    fireEvent.click(increment);

    expect(setSeriesProgressAction).not.toHaveBeenCalled();
  });
});
