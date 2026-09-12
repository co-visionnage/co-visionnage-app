'use client';

import { Check, PlusCircle, Users } from 'lucide-react';
import { useState } from 'react';

import { CreateFamilyForm, JoinFamilyForm } from '@/app/_components/Forms';
import { useAppSounds } from '@/shared/hooks';
import { FamilyMembership } from '@/shared/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/lib';

interface FamilySwitcherDialogProperties {
  memberships: FamilyMembership[];
  activeFamilyId: string;
}

const ROLE_LABELS: Record<FamilyMembership['role'], string> = {
  owner: 'Владелец',
  admin: 'Админ',
  member: 'Участник',
};

export const FamilySwitcherDialog = ({
  memberships,
  activeFamilyId,
}: FamilySwitcherDialogProperties) => {
  const { playClick } = useAppSounds();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const handleSwitch = async (familyId: string) => {
    if (familyId === activeFamilyId) return;

    playClick();
    setIsSwitching(true);

    try {
      await fetch('/api/family/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId }),
      });
      globalThis.location.reload();
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          className='border-4 border-black bg-pink-300 px-4 py-3 font-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
          onClick={() => playClick()}
        >
          <Users className='mr-2 h-4 w-4' />
          МОИ СЕМЬИ ({memberships.length})
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-md border-4 border-black bg-pink-200 [&>button]:top-4 [&>button]:right-4 [&>button]:rounded-none [&>button]:border-2 [&>button]:border-black [&>button]:bg-white [&>button]:opacity-100 [&>button]:hover:bg-red-500'>
        <DialogHeader>
          <DialogTitle className='brutal-font text-2xl font-black text-black uppercase'>
            Мои семьи
          </DialogTitle>
        </DialogHeader>

        <div className='grid gap-2'>
          {memberships.map((membership) => (
            <button
              key={membership.family.id}
              className={`flex items-center justify-between gap-2 border-2 border-black p-3 text-left font-bold transition-all ${
                membership.family.id === activeFamilyId
                  ? 'bg-lime-400 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                  : 'bg-white hover:bg-gray-100'
              }`}
              disabled={isSwitching}
              type='button'
              onClick={() => void handleSwitch(membership.family.id)}
            >
              <span>
                <span className='block font-black text-black'>
                  {membership.family.name}
                </span>
                <span className='text-xs font-bold text-gray-500 uppercase'>
                  {ROLE_LABELS[membership.role]}
                </span>
              </span>
              {membership.family.id === activeFamilyId ? (
                <Check className='h-4 w-4 shrink-0' />
              ) : undefined}
            </button>
          ))}
        </div>

        <Button
          className='mt-2 border-2 border-black bg-white font-black text-black hover:bg-gray-100'
          onClick={() => {
            playClick();
            setIsAdding((previous) => !previous);
          }}
        >
          <PlusCircle className='mr-2 h-4 w-4' />
          {isAdding ? 'Скрыть' : 'Создать или вступить в другую семью'}
        </Button>

        {isAdding ? (
          <div className='grid gap-4 border-t-4 border-dashed border-black pt-4'>
            <CreateFamilyForm />
            <JoinFamilyForm />
          </div>
        ) : undefined}
      </DialogContent>
    </Dialog>
  );
};
