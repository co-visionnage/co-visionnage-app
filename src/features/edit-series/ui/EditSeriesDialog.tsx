'use client';

import type { ReactNode } from 'react';

import { useState } from 'react';

import { uploadSeriesImage } from '@/shared/api/storage/client';
import { Series, SeriesData } from '@/shared/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/shared/ui/lib';

interface EditSeriesProperties {
  includeRating?: boolean;
  onSave: (id: string, data: Partial<SeriesData>) => void | Promise<void>;
  series: Series;
  trigger: ReactNode;
}

export const EditSeriesDialog = ({
  includeRating,
  onSave,
  series,
  trigger,
}: EditSeriesProperties) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>();
  const [imageFile, setImageFile] = useState<File | null>();
  const [editData, setEditData] = useState<Partial<SeriesData>>({
    comment: series.comment ?? '',
    genres: series.genres,
    image_url: series.image_url ?? undefined,
    rating: series.rating ?? 5,
    title: series.title,
    year: series.year,
  });

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setUploadError(undefined);

    try {
      let nextImageUrl = editData.image_url;

      if (imageFile) {
        nextImageUrl = await uploadSeriesImage(imageFile);
      }

      await onSave(series.id, {
        ...editData,
        image_url: nextImageUrl,
      });
      setIsOpen(false);
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : 'Не удалось обновить изображение',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className='max-w-md border-4 border-black bg-cyan-400 [&>button]:top-4 [&>button]:right-4 [&>button]:rounded-none [&>button]:border-2 [&>button]:border-black [&>button]:bg-white [&>button]:opacity-100 [&>button]:hover:bg-red-500'>
        <DialogHeader>
          <div className='mb-4 -rotate-1 transform border-2 border-black bg-purple-600 p-2 text-yellow-300'>
            <DialogTitle className='brutal-font text-xl font-black'>
              РЕДАКТИРОВАТЬ
            </DialogTitle>
          </div>
          <DialogDescription className='brutal-font text-center font-bold text-black'>
            Измени данные сериала
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-4 py-4'>
          <div className='rotate-1 border-2 border-black bg-lime-400 p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'>
            <Label className='brutal-font font-black text-black'>
              НАЗВАНИЕ
            </Label>
            <Input
              className='brutal-font border-2 border-black bg-yellow-300 font-bold'
              value={editData.title}
              onChange={(event) =>
                setEditData({ ...editData, title: event.target.value })
              }
            />
          </div>

          <div className='-rotate-1 border-2 border-black bg-pink-400 p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'>
            <Label className='brutal-font font-black text-black'>ЖАНР</Label>
            <Input
              className='brutal-font border-2 border-black bg-orange-300 font-bold'
              value={
                Array.isArray(editData.genres)
                  ? editData.genres.join(', ')
                  : editData.genres
              }
              onChange={(event) => {
                const genresArray = event.target.value
                  .split(/[ ,]+/)
                  .map((genre) => genre.trim())
                  .filter(Boolean);

                setEditData({ ...editData, genres: genresArray });
              }}
            />
          </div>

          <div className='rotate-1 border-2 border-black bg-orange-400 p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'>
            <Label className='brutal-font font-black text-black'>
              ГОД ВЫПУСКА
            </Label>
            <Input
              className='brutal-font border-2 border-black bg-cyan-300 font-bold'
              type='number'
              value={editData.year}
              onChange={(event) =>
                setEditData({ ...editData, year: Number(event.target.value) })
              }
            />
          </div>

          <div className='-rotate-1 border-2 border-black bg-yellow-400 p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'>
            <Label className='brutal-font font-black text-black'>
              ИЗОБРАЖЕНИЕ
            </Label>
            <Input
              accept='image/*'
              className='brutal-font border-2 border-black bg-pink-300 file:border-0 file:bg-black file:font-black file:text-white'
              type='file'
              onChange={(event) =>
                setImageFile(event.target.files?.[0] ?? undefined)
              }
            />
            {imageFile ? (
              <p className='mt-2 text-xs font-black text-black'>
                Выбрано: {imageFile.name}
              </p>
            ) : undefined}
            {uploadError ? (
              <p className='mt-2 text-xs font-black text-red-700'>
                {uploadError}
              </p>
            ) : undefined}
          </div>

          {includeRating ? (
            <>
              <div className='rotate-1 border-2 border-black bg-purple-400 p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'>
                <Label className='brutal-font font-black text-black'>
                  ОЦЕНКА
                </Label>
                <Select
                  value={editData.rating?.toString()}
                  onValueChange={(value) =>
                    setEditData({ ...editData, rating: Number(value) })
                  }
                >
                  <SelectTrigger className='brutal-font border-2 border-black bg-yellow-300 font-bold'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className='border-2 border-black bg-pink-300 font-bold'>
                    <SelectItem value='5'>★★★★★ ОТЛИЧНО!</SelectItem>
                    <SelectItem value='4'>★★★★ ХОРОШО</SelectItem>
                    <SelectItem value='3'>★★★ НОРМ</SelectItem>
                    <SelectItem value='2'>★★ ПЛОХО</SelectItem>
                    <SelectItem value='1'>★ УЖАСНО</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='-rotate-1 border-2 border-black bg-lime-400 p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'>
                <Label
                  className='brutal-font font-black text-black'
                  htmlFor='edit-comment'
                >
                  КОММЕНТАРИЙ
                </Label>
                <Textarea
                  className='brutal-font min-h-25 border-2 border-black bg-cyan-300 font-bold text-black'
                  id='edit-comment'
                  placeholder='Что думаете?'
                  value={editData.comment}
                  onChange={(event) =>
                    setEditData({ ...editData, comment: event.target.value })
                  }
                />
              </div>
            </>
          ) : undefined}
        </div>

        <DialogFooter className='mt-4'>
          <Button
            className='brutal-font w-full border-2 border-black bg-lime-400 font-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-lime-500 active:translate-x-1 active:translate-y-1 active:shadow-none'
            disabled={isSubmitting}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? 'СОХРАНЯЕМ...' : 'СОХРАНИТЬ ИЗМЕНЕНИЯ!'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
