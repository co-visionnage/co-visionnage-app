'use client';

import { Eye, MessageCircle, ShieldAlert, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  addSeriesCommentAction,
  deleteSeriesCommentAction,
  toggleSeriesReactionAction,
} from '@/shared/actions/comments-postgres';
import { createClient } from '@/shared/api/postgres/client';
import { useAppSounds } from '@/shared/hooks';
import { SeriesComment, SeriesReaction } from '@/shared/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Textarea,
} from '@/shared/ui/lib';

const QUICK_EMOJIS = ['🔥', '❤️', '😂', '😱', '👎'];

interface SeriesDiscussionDialogProperties {
  seriesId: string;
  seriesTitle: string;
}

function isAheadOfViewer(
  comment: SeriesComment,
  myProgress: { season: number; episode: number } | undefined,
) {
  if (comment.spoilerSeason === undefined) return false;
  if (!myProgress) return true;

  const commentEpisode = comment.spoilerEpisode ?? 0;

  return (
    comment.spoilerSeason > myProgress.season ||
    (comment.spoilerSeason === myProgress.season &&
      commentEpisode > myProgress.episode)
  );
}

export const SeriesDiscussionDialog = ({
  seriesId,
  seriesTitle,
}: SeriesDiscussionDialogProperties) => {
  const client = useMemo(() => createClient(), []);
  const { playClick } = useAppSounds();
  const [isOpen, setIsOpen] = useState(false);
  const [comments, setComments] = useState<SeriesComment[]>([]);
  const [reactions, setReactions] = useState<SeriesReaction[]>([]);
  const [myProgress, setMyProgress] = useState<
    { season: number; episode: number } | undefined
  >();
  const [revealedCommentIds, setRevealedCommentIds] = useState<Set<string>>(
    new Set(),
  );
  const [draft, setDraft] = useState('');
  const [spoilerSeason, setSpoilerSeason] = useState('');
  const [spoilerEpisode, setSpoilerEpisode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>();

  const loadThread = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      const [commentsResponse, reactionsResponse, progressResponse] =
        await Promise.all([
          client.getSeriesComments(seriesId),
          client.getSeriesReactions(seriesId),
          client.getSeriesProgress(seriesId),
        ]);
      setComments(commentsResponse.comments);
      setReactions(reactionsResponse.reactions);

      const mine = progressResponse.progress.find((entry) => entry.isMine);
      setMyProgress(
        mine
          ? { season: mine.currentSeason, episode: mine.currentEpisode }
          : undefined,
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Не удалось загрузить обсуждение',
      );
    } finally {
      setIsLoading(false);
    }
  }, [client, seriesId]);

  useEffect(() => {
    if (isOpen) {
      void loadThread();
    } else {
      setRevealedCommentIds(new Set());
    }
  }, [isOpen, loadThread]);

  const handleAddComment = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;

    const season = Number.parseInt(spoilerSeason, 10);
    const episode = Number.parseInt(spoilerEpisode, 10);

    playClick();
    setIsSubmitting(true);
    setError(undefined);

    const result = await addSeriesCommentAction(
      seriesId,
      trimmed,
      Number.isFinite(season) && season > 0
        ? { season, episode: Number.isFinite(episode) ? episode : undefined }
        : undefined,
    );

    if (result.error) {
      setError(result.error);
    } else {
      setDraft('');
      setSpoilerSeason('');
      setSpoilerEpisode('');
      await loadThread();
    }

    setIsSubmitting(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    playClick();
    const result = await deleteSeriesCommentAction(commentId);

    if (result.error) {
      setError(result.error);
    } else {
      await loadThread();
    }
  };

  const handleToggleReaction = async (emoji: string) => {
    playClick();
    const result = await toggleSeriesReactionAction(seriesId, emoji);

    if (result.error) {
      setError(result.error);
    } else {
      await loadThread();
    }
  };

  const handleReveal = (commentId: string) => {
    playClick();
    setRevealedCommentIds((previous) => new Set(previous).add(commentId));
  };

  const reactionCount = reactions.reduce((sum, r) => sum + r.count, 0);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          className='brutal-font h-8 w-full border-2 border-black bg-white p-0 text-xs font-black text-black hover:bg-gray-100'
          onClick={() => playClick()}
        >
          <MessageCircle className='mr-1 h-3.5 w-3.5' />
          {comments.length > 0 || reactionCount > 0
            ? `${comments.length} · ${reactionCount}`
            : 'ОБСУДИТЬ'}
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-lg border-4 border-black bg-yellow-300 [&>button]:top-4 [&>button]:right-4 [&>button]:rounded-none [&>button]:border-2 [&>button]:border-black [&>button]:bg-white [&>button]:opacity-100 [&>button]:hover:bg-red-500'>
        <DialogHeader>
          <DialogTitle className='brutal-font text-xl font-black text-black uppercase'>
            {seriesTitle}
          </DialogTitle>
        </DialogHeader>

        <div className='flex flex-wrap gap-2'>
          {QUICK_EMOJIS.map((emoji) => {
            const found = reactions.find((r) => r.emoji === emoji);
            return (
              <button
                key={emoji}
                className={`border-2 border-black px-3 py-1 text-sm font-black transition-all ${
                  found?.reactedByMe
                    ? 'bg-lime-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'bg-white hover:bg-gray-100'
                }`}
                type='button'
                onClick={() => void handleToggleReaction(emoji)}
              >
                {emoji} {found ? found.count : ''}
              </button>
            );
          })}
        </div>

        {isLoading ? <p className='font-black'>Загружаем...</p> : undefined}
        {error ? (
          <p className='border-2 border-red-600 bg-white p-3 font-black text-red-700'>
            {error}
          </p>
        ) : undefined}

        <div className='grid max-h-64 gap-2 overflow-y-auto'>
          {comments.map((comment) => {
            const isSpoiler = isAheadOfViewer(comment, myProgress);
            const isRevealed = revealedCommentIds.has(comment.id);
            const hideBody = isSpoiler && !isRevealed;

            return (
              <div
                key={comment.id}
                className='border-2 border-black bg-white p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              >
                <div className='flex items-start justify-between gap-2'>
                  <p className='text-xs font-black text-gray-500 uppercase'>
                    {comment.authorName}
                    {comment.spoilerSeason ? (
                      <span className='ml-2 text-purple-600'>
                        С{comment.spoilerSeason}
                        {comment.spoilerEpisode
                          ? `Э${comment.spoilerEpisode}`
                          : ''}
                      </span>
                    ) : undefined}
                  </p>
                  {comment.isMine ? (
                    <button
                      className='text-red-600 hover:text-red-800'
                      type='button'
                      onClick={() => void handleDeleteComment(comment.id)}
                    >
                      <Trash2 className='h-3.5 w-3.5' />
                    </button>
                  ) : undefined}
                </div>
                {hideBody ? (
                  <button
                    className='mt-1 flex w-full items-center gap-2 border-2 border-dashed border-purple-500 bg-purple-50 p-2 text-left text-sm font-black text-purple-700 hover:bg-purple-100'
                    type='button'
                    onClick={() => handleReveal(comment.id)}
                  >
                    <ShieldAlert className='h-4 w-4 shrink-0' />
                    Спойлер — вы ещё не досмотрели до этой серии
                    <Eye className='ml-auto h-4 w-4 shrink-0' />
                  </button>
                ) : (
                  <p className='font-bold text-black'>{comment.body}</p>
                )}
              </div>
            );
          })}
          {!isLoading && comments.length === 0 ? (
            <p className='font-bold text-black/60'>
              Пока никто ничего не написал.
            </p>
          ) : undefined}
        </div>

        <div className='flex flex-col gap-2'>
          <Textarea
            className='border-2 border-black bg-white font-bold'
            placeholder='Написать комментарий...'
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className='flex items-center gap-2'>
            <ShieldAlert className='h-4 w-4 shrink-0 text-purple-600' />
            <span className='text-xs font-bold text-black/60'>
              Спойлер до серии (необязательно):
            </span>
            <Input
              className='h-8 w-16 border-2 border-black bg-white text-center text-sm font-bold'
              min={1}
              placeholder='Сезон'
              type='number'
              value={spoilerSeason}
              onChange={(event) => setSpoilerSeason(event.target.value)}
            />
            <Input
              className='h-8 w-16 border-2 border-black bg-white text-center text-sm font-bold'
              min={0}
              placeholder='Серия'
              type='number'
              value={spoilerEpisode}
              onChange={(event) => setSpoilerEpisode(event.target.value)}
            />
          </div>
          <Button
            className='border-2 border-black bg-lime-400 font-black text-black hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-60'
            disabled={isSubmitting || draft.trim().length === 0}
            onClick={() => void handleAddComment()}
          >
            Отправить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
