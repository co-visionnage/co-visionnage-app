'use client';

import { Crown, Trash2, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { createClient } from '@/shared/api/postgres/client';
import { useAppSounds } from '@/shared/hooks';
import { FamilyMember, FamilyRole } from '@/shared/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/lib';

interface FamilyMembersDialogProperties {
  familyId: string;
  currentUserId: string;
  currentUserRole: FamilyRole;
}

export function FamilyMembersDialog({
  familyId,
  currentUserId,
  currentUserRole,
}: FamilyMembersDialogProperties) {
  const client = useMemo(() => createClient(), []);
  const { playClick } = useAppSounds();
  const [isOpen, setIsOpen] = useState(false);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [error, setError] = useState<string | null>();
  const [isLoading, setIsLoading] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>();

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      const response = await client.getFamilyMembers(familyId);
      setMembers(response.members);
    } catch (membersError) {
      setError(
        membersError instanceof Error
          ? membersError.message
          : 'Не удалось загрузить участников',
      );
    } finally {
      setIsLoading(false);
    }
  }, [client, familyId]);

  useEffect(() => {
    if (isOpen) {
      void loadMembers();
    }
  }, [isOpen, loadMembers]);

  const handleRemove = async (memberUserId: string) => {
    playClick();
    setRemovingUserId(memberUserId);
    setError(undefined);

    try {
      await client.removeFamilyMember(familyId, memberUserId);
      await loadMembers();
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : 'Не удалось удалить участника',
      );
    } finally {
      setRemovingUserId(undefined);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          className='border-4 border-black bg-white px-4 py-3 font-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
          onClick={() => playClick()}
        >
          <Users className='mr-2 h-4 w-4' />
          УЧАСТНИКИ
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-lg border-4 border-black bg-yellow-300 [&>button]:top-4 [&>button]:right-4 [&>button]:rounded-none [&>button]:border-2 [&>button]:border-black [&>button]:bg-white [&>button]:opacity-100 [&>button]:hover:bg-red-500'>
        <DialogHeader>
          <DialogTitle className='brutal-font text-2xl font-black text-black uppercase'>
            Участники семьи
          </DialogTitle>
        </DialogHeader>

        <div className='grid gap-3'>
          {isLoading ? <p className='font-black'>Загружаем...</p> : undefined}
          {error ? (
            <p className='border-2 border-red-600 bg-white p-3 font-black text-red-700'>
              {error}
            </p>
          ) : undefined}

          {members.map((member) => {
            const isOwner = member.role === 'owner';
            const canRemove =
              currentUserRole === 'owner' &&
              member.userId !== currentUserId &&
              !isOwner;

            return (
              <div
                key={member.userId}
                className='flex items-center justify-between gap-3 border-4 border-black bg-white p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
              >
                <div className='min-w-0'>
                  <p className='truncate font-black text-black'>
                    {member.displayName ?? member.email}
                  </p>
                  <p className='truncate text-xs font-bold text-gray-500'>
                    {member.email}
                  </p>
                </div>

                <div className='flex items-center gap-2'>
                  <span className='inline-flex items-center gap-1 border-2 border-black bg-lime-300 px-2 py-1 text-xs font-black text-black uppercase'>
                    {isOwner ? <Crown className='h-3 w-3' /> : undefined}
                    {isOwner ? 'Владелец' : 'Участник'}
                  </span>

                  {canRemove ? (
                    <Button
                      className='border-2 border-black bg-red-500 px-3 py-2 font-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      disabled={removingUserId === member.userId}
                      onClick={() => void handleRemove(member.userId)}
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  ) : undefined}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
