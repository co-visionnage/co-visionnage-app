'use client';

import { AlertTriangle, Home, MoveLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useAppSounds } from '@/shared/hooks';

const NotFound = () => {
  const router = useRouter();
  const { playClick } = useAppSounds();
  const [glitch, setGlitch] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), 150);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className='fixed inset-0 overflow-hidden bg-red-600'>
      <div
        className={`brutal-font flex min-h-screen w-full flex-col items-center justify-center p-4 transition-transform ${
          glitch ? 'translate-x-1' : 'translate-x-0'
        }`}
      >
        <div className='relative z-0 select-none'>
          <h1 className='text-[8rem] leading-none font-black text-white italic sm:text-[15rem] md:text-[20rem]'>
            404
          </h1>
          <div className='absolute top-4 left-4 -z-10 text-[8rem] leading-none font-black text-black italic opacity-30 sm:text-[15rem] md:text-[20rem]'>
            404
          </div>
        </div>

        <div className='relative z-10 w-full max-w-[calc(100vw-48px)] -rotate-2 border-[6px] border-black bg-yellow-400 p-6 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-transform hover:rotate-0 sm:max-w-xl md:p-8'>
          <div className='mb-4 flex items-center gap-4'>
            <AlertTriangle className='shrink-0' size={48} strokeWidth={3} />
            <h2 className='text-2xl font-black tracking-tighter uppercase sm:text-4xl'>
              ОШИБКА!
            </h2>
          </div>

          <p className='mb-8 text-lg leading-tight font-bold md:text-xl'>
            СТРАНИЦЫ НЕ СУЩЕСТВУЕТ В НАШЕЙ РЕАЛЬНОСТИ.
          </p>

          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <button
              className='flex items-center justify-center gap-2 border-4 border-black bg-white p-4 font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-colors hover:bg-black hover:text-white active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'
              onClick={() => {
                playClick();
                router.back();
              }}
            >
              <MoveLeft /> НАЗАД
            </button>

            <Link
              className='flex items-center justify-center gap-2 border-4 border-black bg-lime-500 p-4 font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-colors hover:bg-black hover:text-white active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'
              href='/'
              onClick={() => playClick()}
            >
              <Home /> ДОМОЙ
            </Link>
          </div>
        </div>

        <div className='fixed right-6 bottom-6 hidden rotate-12 lg:block'>
          <div className='border-4 border-black bg-white p-2 text-sm font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'>
            NOT_FOUND
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
