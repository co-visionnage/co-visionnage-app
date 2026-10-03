import { EmailVerificationBanner } from '@/features/email-verification';
import { getHomePageData } from '@/shared/api/go/queries';
import { getCurrentUser } from '@/shared/api/go/session';
import { getActiveFamilyIdCookie } from '@/shared/lib/activeFamily';
import { SeriesStatus } from '@/shared/types';
import { SeriesHeader } from '@/shared/ui';
import ClientTrackerWrapper from './_components/ClientTrackerWrapper';
import { CreateFamilyForm, JoinFamilyForm } from './_components/Forms';

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className='brutal-font min-h-screen bg-blue-500 p-8'>
        <SeriesHeader />
        <div className='flex flex-col items-center justify-center py-20'>
          <div className='rotate-1 border-4 border-black bg-yellow-400 p-8 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]'>
            <h2 className='text-center text-4xl font-black tracking-tighter uppercase'>
              Войди, чтобы <br /> планировать просмотры!
            </h2>
          </div>
        </div>
      </div>
    );
  }

  // Баннер «email не подтверждён» стоит здесь, а не в корневом layout:
  // чтение сессии в layout сделало бы динамическими все страницы, включая
  // статические юридические.
  const banner = user.emailVerified ? undefined : (
    <EmailVerificationBanner email={user.email} />
  );

  const preferredFamilyId = await getActiveFamilyIdCookie();
  const { membership, memberships, series } =
    await getHomePageData(preferredFamilyId);
  const familyData = membership?.family;

  if (!familyData) {
    return (
      <>
        {banner}
        <div className='brutal-font min-h-screen bg-blue-500 p-8'>
          <SeriesHeader
            userDisplayName={user.displayName ?? user.email}
            userEmail={user.email}
          />
          <div className='flex flex-col items-center justify-center py-10'>
            <div className='w-full max-w-md border-4 border-black bg-white p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]'>
              <h1 className='mb-6 text-4xl font-black tracking-tighter text-black uppercase'>
                Семья не найдена
              </h1>
              <CreateFamilyForm />
              <div className='my-6 border-t-4 border-dashed border-black' />
              <JoinFamilyForm />
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {banner}
      <ClientTrackerWrapper
        currentUserId={user.id}
        currentUserRole={membership.role}
        family={familyData}
        initialSeries={series.map((item) => ({
          ...item,
          status: item.status as SeriesStatus,
        }))}
        memberships={memberships}
        userDisplayName={user.displayName ?? user.email}
        userEmail={user.email}
      />
    </>
  );
}
