import { SquarePen } from 'lucide-react';

import { SeriesCard } from '@/entities/series';
import { EditSeriesDialog, MarkWatchedDialog } from '@/features';
import { useAppSounds } from '@/shared/hooks';
import { Series, SeriesData } from '@/shared/types';
import { Badge, Button } from '@/shared/ui/lib';

interface ToWatchCardProperties {
  index: number;
  onDelete: (id: string) => void;
  onEdit: (id: string, data: Partial<SeriesData>) => void;
  onMarkWatched: (id: string, rating: number, comment: string) => void;
  series: Series;
}

export const ToWatchCard = ({
  index,
  onDelete,
  onEdit,
  onMarkWatched,
  series,
}: ToWatchCardProperties) => {
  const { playClick } = useAppSounds();

  return (
    <SeriesCard
      actions={
        <EditSeriesDialog
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
        <div onClick={() => playClick()}>
          <MarkWatchedDialog series={series} onMark={onMarkWatched} />
        </div>
      }
      index={index}
      series={series}
      variant='to-watch'
      onDelete={() => onDelete(series.id)}
    >
      <div className='flex flex-wrap gap-2'>
        {series.genres.map((genre) => (
          <Badge
            key={genre}
            className='brutal-font border-2 border-black bg-black font-bold text-lime-300'
          >
            {genre.toUpperCase()}
          </Badge>
        ))}
      </div>
    </SeriesCard>
  );
};
