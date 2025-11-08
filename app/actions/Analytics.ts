"use server";

import { createClient } from '@/utils/supabase/server';
import { auth } from '@clerk/nextjs/server';

export interface EmployeeStats {
  userId: string;
  userName: string;
  userEmail: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  reportsSubmitted: number;
  completionRate: number;
  averageCompletionTime: number | null; // in hours
  lastActivity: string | null;
  // AFK and work time data
  isAFK: boolean;
  afkCount: number; // number of times went AFK today
  workTimeMs: number; // total active work time in milliseconds today
  dailyGoalMs: number; // daily goal (8 hours = 28800000 ms)
  remainingTimeMs: number; // remaining time to complete daily goal
  workTimeCompletionPercent: number; // percentage of daily goal completed
}

export interface TaskAnalytics {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  cancelledTasks: number;
  overdueTasks: number;
  completionRate: number;
  tasksByPriority: {
    low: number;
    medium: number;
    high: number;
    urgent: number;
  };
  tasksByStatus: {
    pending: number;
    in_progress: number;
    completed: number;
    cancelled: number;
  };
  tasksCreatedThisWeek: number;
  tasksCompletedThisWeek: number;
}

export interface ActivityTimeline {
  date: string;
  tasksCreated: number;
  tasksCompleted: number;
  reportsSubmitted: number;
}

export interface ManagerAnalytics {
  employeeStats: EmployeeStats[];
  taskAnalytics: TaskAnalytics;
  activityTimeline: ActivityTimeline[];
  totalEmployees: number;
  activeEmployees: number; // employees with tasks assigned
}

// Get analytics data for managers/admins
export async function getManagerAnalytics(org_id: string): Promise<ManagerAnalytics> {
  const supabase = await createClient();
  const { userId } = await auth();
  
  if (!userId) {
    throw new Error('Unauthorized');
  }

  // Get all tasks for the organization
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select(`
      *,
      assignments:task_assignments(*),
      reports:task_reports(*)
    `)
    .eq('org_id', org_id)
    .order('created_at', { ascending: false });

  if (tasksError) throw tasksError;

  const allTasks = tasks || [];
  const now = new Date();

  // Calculate task analytics
  const taskAnalytics: TaskAnalytics = {
    totalTasks: allTasks.length,
    completedTasks: allTasks.filter(t => t.status === 'completed').length,
    pendingTasks: allTasks.filter(t => t.status === 'pending').length,
    inProgressTasks: allTasks.filter(t => t.status === 'in_progress').length,
    cancelledTasks: allTasks.filter(t => t.status === 'cancelled').length,
    overdueTasks: allTasks.filter(t => {
      if (!t.due_date || t.status === 'completed' || t.status === 'cancelled') return false;
      return new Date(t.due_date) < now;
    }).length,
    completionRate: allTasks.length > 0 
      ? Math.round((allTasks.filter(t => t.status === 'completed').length / allTasks.length) * 100)
      : 0,
    tasksByPriority: {
      low: allTasks.filter(t => t.priority === 'low').length,
      medium: allTasks.filter(t => t.priority === 'medium').length,
      high: allTasks.filter(t => t.priority === 'high').length,
      urgent: allTasks.filter(t => t.priority === 'urgent').length,
    },
    tasksByStatus: {
      pending: allTasks.filter(t => t.status === 'pending').length,
      in_progress: allTasks.filter(t => t.status === 'in_progress').length,
      completed: allTasks.filter(t => t.status === 'completed').length,
      cancelled: allTasks.filter(t => t.status === 'cancelled').length,
    },
    tasksCreatedThisWeek: allTasks.filter(t => {
      const created = new Date(t.created_at);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return created >= weekAgo;
    }).length,
    tasksCompletedThisWeek: allTasks.filter(t => {
      if (t.status !== 'completed') return false;
      const updated = new Date(t.updated_at);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return updated >= weekAgo;
    }).length,
  };

  // Collect all unique user IDs from assignments
  const userIds = new Set<string>();
  const userAssignments = new Map<string, any[]>();
  const userReports = new Map<string, any[]>();

  allTasks.forEach(task => {
    if (task.assignments) {
      task.assignments.forEach((assignment: any) => {
        userIds.add(assignment.assigned_to);
        if (!userAssignments.has(assignment.assigned_to)) {
          userAssignments.set(assignment.assigned_to, []);
        }
        userAssignments.get(assignment.assigned_to)!.push({
          ...assignment,
          task,
        });
      });
    }
    if (task.reports) {
      task.reports.forEach((report: any) => {
        userIds.add(report.submitted_by);
        if (!userReports.has(report.submitted_by)) {
          userReports.set(report.submitted_by, []);
        }
        userReports.get(report.submitted_by)!.push(report);
      });
    }
  });

  // Get user details from Clerk (we'll need to fetch this differently)
  // For now, we'll use the user IDs we have and create stats
  const employeeStats: EmployeeStats[] = Array.from(userIds).map(userId => {
    const assignments = userAssignments.get(userId) || [];
    const reports = userReports.get(userId) || [];
    
    const completedAssignments = assignments.filter((a: any) => a.status === 'completed');
    const pendingAssignments = assignments.filter((a: any) => a.status === 'pending');
    const inProgressAssignments = assignments.filter((a: any) => a.status === 'in_progress');
    
    const overdueAssignments = assignments.filter((a: any) => {
      if (!a.task?.due_date || a.status === 'completed') return false;
      return new Date(a.task.due_date) < now;
    });

    // Calculate average completion time
    let averageCompletionTime: number | null = null;
    if (completedAssignments.length > 0) {
      const completionTimes = completedAssignments
        .filter((a: any) => a.completed_at && a.assigned_at)
        .map((a: any) => {
          const assigned = new Date(a.assigned_at);
          const completed = new Date(a.completed_at);
          return (completed.getTime() - assigned.getTime()) / (1000 * 60 * 60); // hours
        });
      
      if (completionTimes.length > 0) {
        averageCompletionTime = completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length;
      }
    }

    // Get last activity (most recent report or assignment update)
    let lastActivity: string | null = null;
    const allActivities = [
      ...reports.map((r: any) => r.created_at),
      ...completedAssignments.map((a: any) => a.completed_at).filter(Boolean),
      ...assignments.map((a: any) => a.assigned_at),
    ].filter(Boolean);
    
    if (allActivities.length > 0) {
      lastActivity = allActivities.sort().reverse()[0];
    }

    // TODO: Fetch AFK and work time data from database when available
    // For now, using placeholder values
    const dailyGoalMs = 8 * 60 * 60 * 1000; // 8 hours
    const workTimeMs = 0; // Will be fetched from database
    const isAFK = false; // Will be fetched from database
    const afkCount = 0; // Will be fetched from database
    const remainingTimeMs = Math.max(0, dailyGoalMs - workTimeMs);
    const workTimeCompletionPercent = dailyGoalMs > 0 
      ? Math.round((workTimeMs / dailyGoalMs) * 100) 
      : 0;

    return {
      userId,
      userName: `User ${userId.slice(0, 8)}`, // Placeholder - will be replaced with actual names
      userEmail: '', // Placeholder - will be replaced with actual emails
      totalTasks: assignments.length,
      completedTasks: completedAssignments.length,
      pendingTasks: pendingAssignments.length,
      inProgressTasks: inProgressAssignments.length,
      overdueTasks: overdueAssignments.length,
      reportsSubmitted: reports.length,
      completionRate: assignments.length > 0
        ? Math.round((completedAssignments.length / assignments.length) * 100)
        : 0,
      averageCompletionTime,
      lastActivity,
      isAFK,
      afkCount,
      workTimeMs,
      dailyGoalMs,
      remainingTimeMs,
      workTimeCompletionPercent,
    };
  });

  // Generate activity timeline (last 30 days)
  const timeline: ActivityTimeline[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const dayStart = new Date(dateStr);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dateStr);
    dayEnd.setHours(23, 59, 59, 999);

    const tasksCreated = allTasks.filter(t => {
      const created = new Date(t.created_at);
      return created >= dayStart && created <= dayEnd;
    }).length;

    const tasksCompleted = allTasks.filter(t => {
      if (t.status !== 'completed') return false;
      const updated = new Date(t.updated_at);
      return updated >= dayStart && updated <= dayEnd;
    }).length;

    const reportsSubmitted = allTasks.reduce((acc, task) => {
      if (!task.reports) return acc;
      return acc + task.reports.filter((r: any) => {
        const created = new Date(r.created_at);
        return created >= dayStart && created <= dayEnd;
      }).length;
    }, 0);

    timeline.push({
      date: dateStr,
      tasksCreated,
      tasksCompleted,
      reportsSubmitted,
    });
  }

  return {
    employeeStats: employeeStats.sort((a, b) => b.totalTasks - a.totalTasks),
    taskAnalytics,
    activityTimeline: timeline,
    totalEmployees: userIds.size,
    activeEmployees: employeeStats.filter(e => e.totalTasks > 0).length,
  };
}


