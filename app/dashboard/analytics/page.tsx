import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { getManagerAnalytics } from '@/app/actions/Analytics';
import ManagerAnalyticsDashboard from './_components/ManagerAnalyticsDashboard';

export default async function AnalyticsPage() {
  const { userId, orgId, orgRole } = await auth();

  if (!userId || !orgId) {
    redirect('/dashboard');
  }

  // Check if user is admin/manager
  // Handle both "org:admin" and "admin" role formats
  const isManager = orgRole === 'org:admin' || orgRole === 'admin' || orgRole?.includes('admin');

  if (!isManager) {
    console.log('User is not a manager. Role:', orgRole);
    redirect('/dashboard');
  }

  // Fetch analytics data
  let analytics;
  try {
    analytics = await getManagerAnalytics(orgId);
    
    // Enrich with Clerk user data if organization is available
    // Note: We'll need to pass organization from client or use a different approach
    // For now, we'll use the basic stats
  } catch (error) {
    console.error('Error fetching analytics:', error);
    analytics = {
      employeeStats: [],
      taskAnalytics: {
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        inProgressTasks: 0,
        cancelledTasks: 0,
        overdueTasks: 0,
        completionRate: 0,
        tasksByPriority: { low: 0, medium: 0, high: 0, urgent: 0 },
        tasksByStatus: { pending: 0, in_progress: 0, completed: 0, cancelled: 0 },
        tasksCreatedThisWeek: 0,
        tasksCompletedThisWeek: 0,
      },
      activityTimeline: [],
      totalEmployees: 0,
      activeEmployees: 0,
    };
  }

  return <ManagerAnalyticsDashboard initialData={analytics} orgId={orgId} />;
}

