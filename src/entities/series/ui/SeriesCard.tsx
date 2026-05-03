import { X } from 'lucide-react';
import { ReactNode } from 'react';

import { useAppSounds } from '@/shared/hooks';
import { SeriesStatus } from '@/shared/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/lib';
import { CARD_COLORS, CARD_ROTATIONS, HEADER_COLORS } from '../model/constants';
import { SeriesPoster } from './SeriesPoster';

interface SeriesCardProperties {
  series: {
    title: string;
    year: number;
    image_url?: string | null;
  };
  index: number;
  variant?: SeriesStatus;
  actions?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  onDelete?: () => void;
}

export const SeriesCard = ({
  series,
  index,
  actions,
  footer,
  children,
  variant = 'to-watch',
  onDelete,
}: SeriesCardProperties) => {
  const { playClick, playDelete } = useAppSounds();

  const bgColor = CARD_COLORS[index % CARD_COLORS.length];
  const headerColor = HEADER_COLORS[index % HEADER_COLORS.length];
  const rotation = CARD_ROTATIONS[index % CARD_ROTATIONS.length];

  return (
    <Card
      className={`${bgColor} transform border-4 border-black transition-transform hover:scale-105 ${rotation} flex flex-col overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:rotate-0`}
    >
      <div className='relative h-48 w-full border-b-4 border-black'>
        <SeriesPoster
          src={series.image_url ?? undefined}
          title={series.title}
        />
        <div className='absolute top-2 right-2 z-10 flex gap-2'>
          {actions}
          {onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className='flex h-8 w-8 items-center justify-center border-2 border-black bg-red-500 text-white hover:bg-red-600 active:translate-y-0.5'
                  onClick={() => playClick()}
                >
                  <X />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className='border-4 border-black bg-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]'>
                <AlertDialogHeader>
                  <AlertDialogTitle className='text-2xl font-black uppercase'>
                    Удалить это?
                  </AlertDialogTitle>
                  <AlertDialogDescription className='font-bold text-black'>
                    Сериал «{series.title}» будет безвозвратно стерт из истории
                    (твоего браузера).
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className='mt-4 gap-4'>
                  <AlertDialogCancel className='border-2 border-black bg-yellow-400 font-black text-black hover:bg-yellow-500'>
                    НЕТ, СТОЙ!
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className='border-2 border-black bg-red-500 font-black text-white hover:bg-red-700'
                    onClick={() => {
                      playDelete();
                      onDelete();
                    }}
                  >
                    ДА, УДАЛЯЙ
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <CardHeader className={`pb-2 ${headerColor} border-b-2 border-black`}>
        <CardTitle className='brutal-font text-lg font-black text-black'>
          {series.title.toUpperCase()}
        </CardTitle>
        <CardDescription className='brutal-font font-bold text-black'>
          {series.year}
        </CardDescription>
      </CardHeader>

      <CardContent
        className={`flex grow flex-col ${variant === 'to-watch' ? 'bg-cyan-300' : 'bg-orange-300'}`}
      >
        <div className='mt-4 grow space-y-3'>{children}</div>
        <div className='space-y-3 pt-2'>{footer}</div>
      </CardContent>
    </Card>
  );
};
