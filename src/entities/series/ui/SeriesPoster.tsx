import Image from 'next/image';
import { useMemo } from 'react';

const colors = [
  'bg-pink-500',
  'bg-purple-500',
  'bg-cyan-500',
  'bg-yellow-500',
  'bg-lime-500',
];

export const SeriesPoster = ({
  title,
  src,
}: {
  title: string;
  src?: string;
}) => {
  const randomColor = useMemo(
    () => colors[Math.abs(title.length) % colors.length],
    [title],
  );

  const hasValidImage = src && src.trim() !== '';

  if (hasValidImage) {
    return (
      <Image
        fill
        alt={title}
        className='object-cover'
        sizes='(min-width: 768px) 33vw, 100vw'
        src={src}
      />
    );
  }

  return (
    <div
      className={`flex h-full w-full items-center justify-center border-b-4 border-black ${randomColor} transition-colors duration-500`}
    >
      <span className='text-8xl font-black text-black drop-shadow-[4px_4px_0px_white] select-none'>
        {title[0]?.toUpperCase() || '?'}
      </span>
    </div>
  );
};
