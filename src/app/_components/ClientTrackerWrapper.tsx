import { FamilyMembership, FamilyRole, Series } from '@/shared/types';
import SeriesTracker from './SeriesTracker';

interface Properties {
  currentUserId: string;
  currentUserRole: FamilyRole;
  userDisplayName?: string;
  userEmail?: string;
  family: {
    id: string;
    name: string;
    invite_code: string;
  };
  memberships: FamilyMembership[];
  initialSeries: Series[];
}

export default function ClientTrackerWrapper({
  currentUserId,
  currentUserRole,
  userDisplayName,
  userEmail,
  family,
  memberships,
  initialSeries,
}: Properties) {
  return (
    <SeriesTracker
      currentUserId={currentUserId}
      currentUserRole={currentUserRole}
      family={family}
      initialSeries={initialSeries}
      memberships={memberships}
      userDisplayName={userDisplayName}
      userEmail={userEmail}
    />
  );
}
