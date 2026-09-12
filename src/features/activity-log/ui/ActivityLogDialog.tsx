'use client';

import { ScrollText } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { createClient } from '@/shared/api/postgres/client';
import { useAppSounds } from '@/shared/hooks';
import { FamilyActivityEntry } from '@/shared/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/lib';

interface ActivityLogDialogProperties {
  familyId: string;
}

function describeEntry(entry: FamilyActivityEntry): string {
  switch (entry.action) {
    case 'series_added': {
      return `добавил(а) «${entry.detail}»`;
    }
    case 'series_removed': {
      return `удалил(а) «${entry.detail}»`;
    }
    case 'member_joined': {
      return 'присоединился(ась) к семье';
    }
    case 'role_changed': {
      return `изменил(а) роль ${entry.targetLabel ?? 'участника'} на «${entry.detail}»`;
    }
    case 'ownership_transferred': {
      return `передал(а) владение семьёй пользователю ${entry.targetLabel ?? ''}`;
    }
    default: {
      return entry.action;
    }
  }
}

export const ActivityLogDialog = ({
  familyId,
}: ActivityLogDialogProperties) => {
  const client = useMemo(() => createClient(), []);
  const { playClick } = useAppSounds();
  const [isOpen, setIsOpen] = useState(false);
  const [entries, setEntries] = useState<FamilyActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { activity } = await client.getFamilyActivityLog(familyId);
      setEntries(activity);
    } finally {
      setIsLoading(false);
    }
  }, [client, familyId]);

  useEffect(() => {
    if (isOpen) {
      void load();
    }
  }, [isOpen, load]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          className='border-4 border-black bg-white px-4 py-3 font-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
          onClick={() => playClick()}
        >
          <ScrollText className='mr-2 h-4 w-4' />
          ЖУРНАЛ
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-lg border-4 border-black bg-yellow-300 [&>button]:top-4 [&>button]:right-4 [&>button]:rounded-none [&>button]:border-2 [&>button]:border-black [&>button]:bg-white [&>button]:opacity-100 [&>button]:hover:bg-red-500'>
        <DialogHeader>
          <DialogTitle className='brutal-font text-2xl font-black text-black uppercase'>
            Журнал действий
          </DialogTitle>
        </DialogHeader>

        {isLoading ? <p className='font-black'>Загружаем...</p> : undefined}

        <div className='grid max-h-[28rem] gap-2 overflow-y-auto'>
          {entries.map((entry) => (
            <div
              key={entry.id}
              className='flex items-center justify-between gap-3 border-2 border-black bg-white p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
            >
              <p className='min-w-0 truncate font-bold text-black'>
                <span className='font-black'>{entry.actorLabel}</span>{' '}
                {describeEntry(entry)}
              </p>
              <span className='shrink-0 text-xs font-bold text-gray-400'>
                {new Date(entry.createdAt).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
            </div>
          ))}
          {!isLoading && entries.length === 0 ? (
            <p className='font-bold text-black/60'>Пока ничего не было.</p>
          ) : undefined}
        </div>
      </DialogContent>
    </Dialog>
  );
};
