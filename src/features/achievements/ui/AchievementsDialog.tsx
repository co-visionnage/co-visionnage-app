'use client';

import { Flame, Trophy } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { createClient } from '@/shared/api/postgres/client';
import { useAppSounds } from '@/shared/hooks';
import { FamilyAchievements } from '@/shared/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/lib';

interface AchievementsDialogProperties {
  familyId: string;
}

export const AchievementsDialog = ({
  familyId,
}: AchievementsDialogProperties) => {
  const client = useMemo(() => createClient(), []);
  const { playClick } = useAppSounds();
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<FamilyAchievements>();
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { achievements } = await client.getFamilyAchievements(familyId);
      setData(achievements);
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
          <Trophy className='mr-2 h-4 w-4' />
          АЧИВКИ
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-lg border-4 border-black bg-yellow-300 [&>button]:top-4 [&>button]:right-4 [&>button]:rounded-none [&>button]:border-2 [&>button]:border-black [&>button]:bg-white [&>button]:opacity-100 [&>button]:hover:bg-red-500'>
        <DialogHeader>
          <DialogTitle className='brutal-font text-2xl font-black text-black uppercase'>
            Достижения
          </DialogTitle>
        </DialogHeader>

        {isLoading || !data ? (
          <p className='font-black'>Считаем...</p>
        ) : (
          <div className='grid gap-4'>
            {data.currentStreakWeeks > 0 ? (
              <div className='flex items-center gap-3 border-4 border-black bg-orange-300 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'>
                <Flame className='h-8 w-8 shrink-0' />
                <p className='font-black text-black'>
                  Серия из {data.currentStreakWeeks}{' '}
                  {data.currentStreakWeeks === 1 ? 'недели' : 'недель'} подряд
                  с активностью!
                </p>
              </div>
            ) : undefined}

            <div className='grid max-h-96 gap-2 overflow-y-auto'>
              {data.achievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className={`border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                    achievement.unlocked
                      ? 'bg-lime-300'
                      : 'bg-white opacity-70'
                  }`}
                >
                  <div className='flex items-center justify-between gap-2'>
                    <p className='font-black text-black'>
                      {achievement.unlocked ? '🏆 ' : '🔒 '}
                      {achievement.title}
                    </p>
                    <span className='text-xs font-bold text-gray-600'>
                      {Math.min(achievement.progress, achievement.target)}/
                      {achievement.target}
                    </span>
                  </div>
                  <p className='text-xs font-bold text-gray-600'>
                    {achievement.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
