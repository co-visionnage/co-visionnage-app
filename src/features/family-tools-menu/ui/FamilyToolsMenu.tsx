'use client';

import { Wrench } from 'lucide-react';
import { useState } from 'react';

import { FamilyMembersDialog } from '@/app/_components/FamilyMembersDialog';
import { AchievementsDialog } from '@/features/achievements';
import { ActivityLogDialog } from '@/features/activity-log';
import { EpisodeCalendarDialog } from '@/features/episode-calendar';
import { FamilyStatsDialog } from '@/features/family-stats';
import { PickForMeDialog } from '@/features/pick-for-me';
import { WatchEventsDialog } from '@/features/watch-events';
import { WatchHistoryDialog } from '@/features/watch-history';
import { WatchPollDialog } from '@/features/watch-poll';
import { YearWrappedDialog } from '@/features/year-wrapped';
import { useAppSounds } from '@/shared/hooks';
import { FamilyRole, Series } from '@/shared/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/lib';

interface FamilyToolsMenuProperties {
  familyId: string;
  familyName: string;
  currentUserId: string;
  currentUserRole: FamilyRole;
  series: Series[];
  toWatchSeries: Series[];
  onRefreshSeries: () => void | Promise<void>;
}

function ToolSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className='grid gap-2'>
      <p className='text-xs font-black text-black/50 uppercase'>{title}</p>
      <div className='flex flex-wrap gap-2'>{children}</div>
    </div>
  );
}

export const FamilyToolsMenu = ({
  familyId,
  familyName,
  currentUserId,
  currentUserRole,
  series,
  toWatchSeries,
  onRefreshSeries,
}: FamilyToolsMenuProperties) => {
  const { playClick } = useAppSounds();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          className='border-4 border-black bg-purple-400 px-4 py-3 font-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
          onClick={() => playClick()}
        >
          <Wrench className='mr-2 h-4 w-4' />
          ИНСТРУМЕНТЫ
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-lg border-4 border-black bg-purple-200 [&>button]:top-4 [&>button]:right-4 [&>button]:rounded-none [&>button]:border-2 [&>button]:border-black [&>button]:bg-white [&>button]:opacity-100 [&>button]:hover:bg-red-500'>
        <DialogHeader>
          <DialogTitle className='brutal-font text-2xl font-black text-black uppercase'>
            Инструменты семьи
          </DialogTitle>
        </DialogHeader>

        <div className='grid gap-4'>
          <ToolSection title='Участники'>
            <FamilyMembersDialog
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              familyId={familyId}
            />
          </ToolSection>

          <ToolSection title='Статистика и достижения'>
            <FamilyStatsDialog familyId={familyId} />
            <AchievementsDialog familyId={familyId} />
            <WatchHistoryDialog familyId={familyId} />
            <ActivityLogDialog familyId={familyId} />
            <YearWrappedDialog familyId={familyId} familyName={familyName} />
          </ToolSection>

          <ToolSection title='Планирование просмотра'>
            <WatchPollDialog
              familyId={familyId}
              toWatchSeries={series.filter(
                (item) => item.status === 'to-watch',
              )}
            />
            <WatchEventsDialog
              currentUserId={currentUserId}
              familyId={familyId}
              toWatchSeries={toWatchSeries}
            />
            <PickForMeDialog toWatchSeries={toWatchSeries} />
            <EpisodeCalendarDialog
              series={series}
              onRefresh={onRefreshSeries}
            />
          </ToolSection>
        </div>
      </DialogContent>
    </Dialog>
  );
};
