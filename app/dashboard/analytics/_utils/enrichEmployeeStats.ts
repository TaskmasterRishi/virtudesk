import { EmployeeStats } from '@/app/actions/Analytics';

// Helper to enrich employee stats with Clerk user data (client-side only)
export function enrichEmployeeStatsWithClerkData(
  employeeStats: EmployeeStats[],
  memberships: any[]
): EmployeeStats[] {
  if (!memberships || memberships.length === 0) return employeeStats;

  try {
    const userMap = new Map<string, { name: string; email: string }>();

    memberships.forEach((membership: any) => {
      const userId = membership.publicUserData?.userId;
      if (userId) {
        const firstName = membership.publicUserData.firstName || '';
        const lastName = membership.publicUserData.lastName || '';
        const name = firstName && lastName ? `${firstName} ${lastName}` : (membership.publicUserData.identifier || 'Unknown');
        const email = membership.publicUserData.identifier || '';
        userMap.set(userId, { name, email });
      }
    });

    return employeeStats.map(stat => {
      const userData = userMap.get(stat.userId);
      return {
        ...stat,
        userName: userData?.name || stat.userName,
        userEmail: userData?.email || stat.userEmail,
      };
    });
  } catch (error) {
    console.error('Error enriching employee stats:', error);
    return employeeStats;
  }
}

