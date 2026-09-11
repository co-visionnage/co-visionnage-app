import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getSeriesById } from '@/shared/api/postgres/queries';
import { getCurrentUser } from '@/shared/api/postgres/server';
import { SeriesHeader } from '@/shared/ui';
import { SeriesDetailView } from './SeriesDetailView';

interface SeriesDetailPageProperties {
  params: Promise<{ id: string }>;
}

export default async function SeriesDetailPage({
  params,
}: SeriesDetailPageProperties) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className='brutal-font min-h-screen bg-blue-500 p-8'>
        <SeriesHeader />
        <div className='flex flex-col items-center justify-center py-20'>
          <div className='rotate-1 border-4 border-black bg-yellow-400 p-8 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]'>
            <h2 className='text-center text-4xl font-black tracking-tighter uppercase'>
              Войди, чтобы посмотреть сериал
            </h2>
          </div>
        </div>
      </div>
    );
  }

  const result = await getSeriesById(id).catch(() => {});

  if (!result) {
    notFound();
  }

  return (
    <div className='brutal-font min-h-screen bg-blue-500 p-4'>
      <div className='mx-auto max-w-2xl'>
        <Link
          className='mb-6 inline-flex items-center gap-2 border-2 border-black bg-white px-4 py-2 font-black text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100'
          href='/'
        >
          ← Ко всем сериалам
        </Link>

        <SeriesDetailView familyId={result.familyId} series={result.series} />
      </div>
    </div>
  );
}
