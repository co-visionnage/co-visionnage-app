'use client';

import { Crown, ShieldCheck, Trash2, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  setMemberRoleAction,
  transferFamilyOwnershipAction,
} from '@/shared/actions/family-postgres';
import { createClient } from '@/shared/api/postgres/client';
import { useAppSounds } from '@/shared/hooks';
import { FamilyMember, FamilyRole } from '@/shared/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
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

const ROLE_LABELS: Record<FamilyRole, string> = {
  owner: 'Владелец',
  admin: 'Админ',
  member: 'Участник',
};

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
  const [pendingUserId, setPendingUserId] = useState<string | null>();

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
    setPendingUserId(memberUserId);
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
      setPendingUserId(undefined);
    }
  };

  const handleToggleAdmin = async (member: FamilyMember) => {
    playClick();
    setPendingUserId(member.userId);
    setError(undefined);

    const nextRole = member.role === 'admin' ? 'member' : 'admin';
    const result = await setMemberRoleAction(familyId, member.userId, nextRole);

    if (result.error) {
      setError(result.error);
    } else {
      await loadMembers();
    }

    setPendingUserId(undefined);
  };

  const handleTransferOwnership = async (memberUserId: string) => {
    playClick();
    setPendingUserId(memberUserId);
    setError(undefined);

    const result = await transferFamilyOwnershipAction(familyId, memberUserId);

    if (result.error) {
      setError(result.error);
    } else {
      await loadMembers();
    }

    setPendingUserId(undefined);
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
            const isSelf = member.userId === currentUserId;
            const isCurrentUserOwner = currentUserRole === 'owner';
            const canRemove = isCurrentUserOwner && !isSelf && !isOwner;
            const canManageRole = isCurrentUserOwner && !isSelf && !isOwner;
            const isPending = pendingUserId === member.userId;

            return (
              <div
                key={member.userId}
                className='flex flex-col gap-2 border-4 border-black bg-white p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
              >
                <div className='flex items-center justify-between gap-3'>
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
                      {ROLE_LABELS[member.role]}
                    </span>

                    {canRemove ? (
                      <Button
                        className='border-2 border-black bg-red-500 px-3 py-2 font-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        disabled={isPending}
                        onClick={() => void handleRemove(member.userId)}
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    ) : undefined}
                  </div>
                </div>

                {canManageRole ? (
                  <div className='flex flex-wrap gap-2'>
                    <Button
                      className='border-2 border-black bg-cyan-300 px-2 py-1 text-xs font-black text-black hover:bg-cyan-400'
                      disabled={isPending}
                      onClick={() => void handleToggleAdmin(member)}
                    >
                      <ShieldCheck className='mr-1 h-3 w-3' />
                      {member.role === 'admin'
                        ? 'Убрать права админа'
                        : 'Сделать админом'}
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          className='border-2 border-black bg-purple-400 px-2 py-1 text-xs font-black text-black hover:bg-purple-500'
                          disabled={isPending}
                        >
                          <Crown className='mr-1 h-3 w-3' />
                          Передать владение
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className='border-4 border-black bg-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]'>
                        <AlertDialogHeader>
                          <AlertDialogTitle className='text-2xl font-black uppercase'>
                            Передать семью?
                          </AlertDialogTitle>
                          <AlertDialogDescription className='font-bold text-black'>
                            {member.displayName ?? member.email} станет
                            владельцем, а вы — обычным участником. Отменить это
                            может только новый владелец.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className='mt-4 gap-4'>
                          <AlertDialogCancel className='border-2 border-black bg-yellow-400 font-black text-black hover:bg-yellow-500'>
                            Отмена
                          </AlertDialogCancel>
                          <AlertDialogAction
                            className='border-2 border-black bg-purple-500 font-black text-white hover:bg-purple-700'
                            onClick={() =>
                              void handleTransferOwnership(member.userId)
                            }
                          >
                            Да, передать
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ) : undefined}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
