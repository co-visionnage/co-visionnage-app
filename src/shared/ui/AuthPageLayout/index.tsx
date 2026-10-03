import type { ReactNode } from 'react';

import Link from 'next/link';

type AuthPageLayoutProperties = {
  title: string;
  children: ReactNode;
};

/**
 * Каркас страниц, на которые ведут ссылки из писем (подтверждение email,
 * сброс пароля): тот же нео-брутализм, что у главной и страницы 404.
 */
export function AuthPageLayout({ title, children }: AuthPageLayoutProperties) {
  return (
    <main className='brutal-font flex min-h-screen flex-col items-center justify-center bg-blue-500 p-4'>
      <Link
        className='mb-6 border-4 border-black bg-black px-4 py-2 text-xl font-black tracking-tighter text-yellow-400 uppercase'
        href='/'
      >
        notrecinema
      </Link>

      <div className='w-full max-w-md border-4 border-black bg-white p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]'>
        <div className='mb-6 h-3 w-16 border-4 border-black bg-yellow-400' />
        <h1 className='mb-6 text-3xl font-black tracking-tighter text-black uppercase'>
          {title}
        </h1>
        {children}
      </div>
    </main>
  );
}
