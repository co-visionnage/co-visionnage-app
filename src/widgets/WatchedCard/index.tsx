import { RotateCcw, SquarePen } from 'lucide-react';

import { SeriesCard } from '@/entities/series';
import { EditSeriesDialog } from '@/features/edit-series';
import { useAppSounds } from '@/shared/hooks';
import { Series, SeriesData } from '@/shared/types';
import { Badge, Button } from '@/shared/ui/lib';

interface WatchedCardProperties {
  index: number;
  onDelete: (id: string) => void;
  onEdit: (id: string, data: Partial<SeriesData>) => void;
  onMoveToWatchList: (id: string) => void;
  series: Series;
}

export const WatchedCard = ({
  index,
  onDelete,
  onEdit,
  onMoveToWatchList,
  series,
}: WatchedCardProperties) => {
  const { playClick } = useAppSounds();

  return (
    <SeriesCard
      actions={
        <EditSeriesDialog
          includeRating
          series={series}
          trigger={
            <Button
              className='h-8 w-8 rounded-none border-2 border-black bg-yellow-400 p-0 text-black hover:bg-yellow-500'
              size='sm'
              variant='ghost'
              onClick={() => playClick()}
            >
              <SquarePen className='h-4 w-4' />
            </Button>
          }
          onSave={onEdit}
        />
      }
      footer={
        <Button
          className='brutal-font w-full border-2 border-black bg-orange-400 font-black text-black transition-all hover:bg-orange-500'
          onClick={() => {
            playClick();
            onMoveToWatchList(series.id);
          }}
        >
          <RotateCcw className='mr-2 h-4 w-4' /> ВЕРНУТЬ В ПЛАНЫ
        </Button>
      }
      index={index}
      series={series}
      variant='watched'
      onDelete={() => onDelete(series.id)}
    >
      <div className='flex flex-col gap-4'>
        <div className='flex flex-wrap gap-2'>
          {series.genres.map((g) => (
            <Badge
              key={g}
              className='brutal-font border-2 border-black bg-black font-bold text-pink-400'
            >
              {String(g).toUpperCase()}
            </Badge>
          ))}

          {series.rating && (
            <Badge className='brutal-font border-2 border-black bg-yellow-300 font-bold text-black'>
              ⭐ {series.rating}/5
            </Badge>
          )}
        </div>

        {series.comment && (
          <div className='rotate-1 border-2 border-black bg-lime-400 p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'>
            <p className='brutal-font mb-1 text-[10px] font-black text-black uppercase'>
              Ваш отзыв:
            </p>
            <div className='border-2 border-black bg-cyan-300 p-2'>
              <p className='brutal-font text-sm leading-tight font-bold text-black'>
                {series.comment}
              </p>
            </div>
          </div>
        )}
      </div>
    </SeriesCard>
  );
};
