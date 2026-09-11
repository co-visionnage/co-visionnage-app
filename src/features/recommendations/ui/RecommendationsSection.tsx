'use client';

import { Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { createClient } from '@/shared/api/postgres/client';
import { Recommendation } from '@/shared/types';

interface RecommendationsSectionProperties {
  familyId: string;
}

export const RecommendationsSection = ({
  familyId,
}: RecommendationsSectionProperties) => {
  const client = useMemo(() => createClient(), []);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  useEffect(() => {
    let cancelled = false;

    client
      .getRecommendations(familyId)
      .then(({ recommendations: next }) => {
        if (!cancelled) setRecommendations(next);
      })
      .catch(() => {
        // best-effort widget — leave the section empty on failure
      });

    return () => {
      cancelled = true;
    };
  }, [client, familyId]);

  const withScore = recommendations.filter((item) => item.score > 0);

  if (withScore.length === 0) {
    return;
  }

  return (
    <div className='mb-8 -rotate-1 border-4 border-black bg-purple-400 p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'>
      <p className='brutal-font mb-3 flex items-center gap-2 text-lg font-black text-black uppercase'>
        <Sparkles className='h-5 w-5' /> Рекомендуем из вашего списка
      </p>
      <div className='flex gap-3 overflow-x-auto pb-1'>
        {withScore.slice(0, 6).map((item) => (
          <div
            key={item.id}
            className='w-40 shrink-0 border-2 border-black bg-white p-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
          >
            <p className='truncate text-sm font-black text-black'>
              {item.title}
            </p>
            <p className='text-xs font-bold text-gray-500'>
              {item.genres.slice(0, 2).join(', ') || item.year}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
