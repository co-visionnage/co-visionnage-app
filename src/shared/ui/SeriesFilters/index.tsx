'use client';

import { useAppSounds } from '@/shared/hooks';
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/lib';
import { FilterBox } from '../FilterBox';

interface FiltersProperties {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  genreFilter: string;
  onGenreChange: (value: string) => void;
  yearFilter: string;
  onYearChange: (value: string) => void;
  ratingFilter: string;
  onRatingChange: (value: string) => void;
  allGenres: string[];
  allYears: number[];
}

export const SeriesFilters = ({
  searchTerm,
  onSearchChange,
  genreFilter,
  onGenreChange,
  yearFilter,
  onYearChange,
  ratingFilter,
  onRatingChange,
  allGenres,
  allYears,
}: FiltersProperties) => {
  const { playClick } = useAppSounds();

  return (
    <section className='mb-8 rotate-1 border-4 border-black bg-orange-400 p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]'>
      <div className='mb-4 -rotate-1 border-2 border-black bg-purple-500 p-4'>
        <h2 className='text-2xl font-black text-yellow-300'>ПОИСК И ФИЛЬТРЫ</h2>
      </div>
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <FilterBox className='bg-lime-400' label='Поиск'>
          <Input
            className='border-2 border-black bg-yellow-300 font-bold placeholder:text-black/50'
            placeholder='НАЗВАНИЕ...'
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            onClick={() => playClick()}
          />
        </FilterBox>

        <FilterBox className='bg-pink-400' label='Жанр' rotate='-rotate-1'>
          <Select value={genreFilter} onValueChange={onGenreChange}>
            <SelectTrigger className='border-2 border-black bg-cyan-300 font-bold'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className='border-2 border-black bg-lime-300'>
              <SelectItem value='all'>ВСЕ ЖАНРЫ</SelectItem>
              {allGenres.map((genre) => (
                <SelectItem key={genre} value={genre}>
                  {genre.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBox>

        <FilterBox className='bg-purple-400' label='Год'>
          <Select value={yearFilter} onValueChange={onYearChange}>
            <SelectTrigger className='border-2 border-black bg-orange-300 font-bold'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className='border-2 border-black bg-pink-300'>
              <SelectItem value='all'>ВСЕ ГОДЫ</SelectItem>
              {allYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBox>

        <FilterBox className='bg-yellow-400' label='Рейтинг' rotate='-rotate-1'>
          <Select value={ratingFilter} onValueChange={onRatingChange}>
            <SelectTrigger className='border-2 border-black bg-lime-300 font-bold'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className='border-2 border-black bg-orange-300'>
              <SelectItem value='all'>ЛЮБОЙ</SelectItem>
              <SelectItem value='5'>★★★★★ (5)</SelectItem>
              <SelectItem value='4+'>★★★★+ (4+)</SelectItem>
              <SelectItem value='3+'>★★★+ (3+)</SelectItem>
            </SelectContent>
          </Select>
        </FilterBox>
      </div>
    </section>
  );
};
