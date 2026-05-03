'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';

import { uploadSeriesImage } from '@/shared/api/storage/client';
import { useAppSounds } from '@/shared/hooks';
import { SeriesData, SeriesStatus } from '@/shared/types';
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

interface AddSeriesDialogProperties {
  onAdd: (series: SeriesData) => void | Promise<void>;
}

export const AddSeriesDialog = ({ onAdd }: AddSeriesDialogProperties) => {
  const [isOpen, setIsOpen] = useState(false);
  const [genreInput, setGenreInput] = useState('');
  const [uploadError, setUploadError] = useState<string | null>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { playClick } = useAppSounds();
  const [newSeries, setNewSeries] = useState({
    comment: '',
    image_url: undefined as string | undefined,
    imageFile: undefined as File | undefined,
    rating: 5,
    status: 'to-watch' as SeriesStatus,
    title: '',
    year: new Date().getFullYear(),
  });

  const handleFileChange = (file: File | undefined) => {
    setNewSeries((previous) => ({
      ...previous,
      imageFile: file,
    }));
    setUploadError(undefined);
  };

  const handleSubmit = async () => {
    if (!newSeries.title.trim() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setUploadError(undefined);

    try {
      let imageUrl = newSeries.image_url;

      if (newSeries.imageFile) {
        imageUrl = await uploadSeriesImage(newSeries.imageFile);
      }

      const genresArray = genreInput
        .split(/[ ,]+/)
        .map((genre) => genre.trim())
        .filter((genre) => genre.length > 0);

      await onAdd({
        title: newSeries.title.trim(),
        genres: genresArray,
        year: newSeries.year,
        status: newSeries.status,
        image_url: imageUrl,
        rating: newSeries.status === 'watched' ? newSeries.rating : undefined,
        comment:
          newSeries.status === 'watched' ? newSeries.comment.trim() : undefined,
      });

      setNewSeries({
        comment: '',
        image_url: undefined,
        imageFile: undefined,
        rating: 5,
        status: 'to-watch',
        title: '',
        year: new Date().getFullYear(),
      });
      setGenreInput('');
      setIsOpen(false);
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : 'Не удалось загрузить изображение',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          className='brutal-font -rotate-2 transform border-4 border-black bg-pink-500 px-8 py-4 text-xl font-black text-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-transform hover:rotate-0 hover:bg-pink-600 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
          onClick={() => playClick()}
        >
          <Plus className='mr-2 h-6 w-6' />
          ДОБАВИТЬ СЕРИАЛ!
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-md border-4 border-black bg-cyan-400 [&>button]:top-4 [&>button]:right-4 [&>button]:rounded-none [&>button]:border-2 [&>button]:border-black [&>button]:bg-white [&>button]:opacity-100 [&>button]:hover:bg-red-500'>
        <DialogHeader>
          <div className='mb-4 -rotate-1 transform border-2 border-black bg-purple-600 p-2 text-yellow-300'>
            <DialogTitle className='brutal-font text-center text-xl font-black'>
              НОВЫЙ СЕРИАЛ!
            </DialogTitle>
          </div>
          <DialogDescription className='brutal-font text-center font-bold text-black'>
            УКАЖИ ЖАНРЫ ЧЕРЕЗ ЗАПЯТУЮ ИЛИ ПРОБЕЛ
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-4 py-4'>
          <div className='rotate-1 transform border-2 border-black bg-lime-400 p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'>
            <Label className='brutal-font font-bold text-black' htmlFor='title'>
              НАЗВАНИЕ
            </Label>
            <Input
              className='brutal-font border-2 border-black bg-yellow-300 font-bold text-black'
              id='title'
              placeholder='ВВЕДИ НАЗВАНИЕ'
              value={newSeries.title}
              onChange={(event) =>
                setNewSeries({ ...newSeries, title: event.target.value })
              }
            />
          </div>

          <div className='-rotate-1 transform border-2 border-black bg-pink-400 p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'>
            <Label className='brutal-font font-bold text-black' htmlFor='genre'>
              ЖАНРЫ
            </Label>
            <Input
              className='brutal-font border-2 border-black bg-orange-300 font-bold text-black'
              id='genre'
              placeholder='ужасы, комедия, драма'
              value={genreInput}
              onChange={(event) => setGenreInput(event.target.value)}
            />
          </div>

          <div className='rotate-1 transform border-2 border-black bg-orange-400 p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'>
            <Label className='brutal-font font-bold text-black' htmlFor='year'>
              ГОД
            </Label>
            <Input
              className='brutal-font border-2 border-black bg-cyan-300 font-bold text-black'
              id='year'
              type='number'
              value={newSeries.year}
              onChange={(event) =>
                setNewSeries({ ...newSeries, year: Number(event.target.value) })
              }
            />
          </div>

          <div className='-rotate-1 transform border-2 border-black bg-purple-400 p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'>
            <Label className='brutal-font font-bold text-black'>СТАТУС</Label>
            <Select
              value={newSeries.status}
              onValueChange={(value: SeriesStatus) =>
                setNewSeries({ ...newSeries, status: value })
              }
            >
              <SelectTrigger className='brutal-font border-2 border-black bg-lime-300 font-bold text-black'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className='border-2 border-black bg-pink-300 font-bold'>
                <SelectItem value='to-watch'>ХОТИМ ПОСМОТРЕТЬ</SelectItem>
                <SelectItem value='watched'>УЖЕ ПОСМОТРЕЛИ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {newSeries.status === 'watched' ? (
            <>
              <div className='rotate-1 transform border-2 border-black bg-yellow-400 p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'>
                <Label className='brutal-font font-bold text-black'>
                  ОЦЕНКА
                </Label>
                <Select
                  value={newSeries.rating.toString()}
                  onValueChange={(value) =>
                    setNewSeries({ ...newSeries, rating: Number(value) })
                  }
                >
                  <SelectTrigger className='brutal-font border-2 border-black bg-white font-bold'>
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

              <div className='-rotate-1 transform border-2 border-black bg-lime-400 p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'>
                <Label
                  className='brutal-font font-bold text-black'
                  htmlFor='comment'
                >
                  КОММЕНТАРИЙ
                </Label>
                <Textarea
                  className='brutal-font border-2 border-black bg-cyan-300 font-bold text-black'
                  id='comment'
                  placeholder='Что думаете?'
                  value={newSeries.comment}
                  onChange={(event) =>
                    setNewSeries({ ...newSeries, comment: event.target.value })
                  }
                />
              </div>
            </>
          ) : undefined}

          <div className='rotate-1 transform border-2 border-black bg-cyan-400 p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'>
            <Label className='brutal-font font-bold text-black'>
              ИЗОБРАЖЕНИЕ
            </Label>
            <Input
              accept='image/*'
              className='brutal-font border-2 border-black bg-pink-300 font-bold text-black file:border-0 file:bg-black file:font-black file:text-white'
              type='file'
              onChange={(event) =>
                handleFileChange(event.target.files?.[0] ?? undefined)
              }
            />
            {newSeries.imageFile ? (
              <p className='mt-2 text-xs font-black text-black'>
                Выбрано: {newSeries.imageFile.name}
              </p>
            ) : undefined}
            {uploadError ? (
              <p className='mt-2 text-xs font-black text-red-700'>
                {uploadError}
              </p>
            ) : undefined}
          </div>
        </div>

        <DialogFooter>
          <Button
            className='brutal-font rotate-1 transform border-2 border-black bg-lime-400 font-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform hover:rotate-0 hover:bg-lime-500 active:translate-x-1 active:translate-y-1 active:shadow-none'
            disabled={isSubmitting}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? 'ЗАГРУЖАЕМ...' : 'ДОБАВИТЬ!'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
