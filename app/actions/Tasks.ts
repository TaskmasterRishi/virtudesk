"use server";

import { createClient } from '@/utils/supabase/server';
import { auth } from '@clerk/nextjs/server';

// Types
export interface Task {
  id: string;
  org_id: string;
  room_id: string | null;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TaskAssignment {
  id: string;
  task_id: string;
  assigned_to: string;
  assigned_by: string;
  assigned_at: string;
  status: 'pending' | 'in_progress' | 'completed';
  completed_at: string | null;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  comment: string;
  created_at: string;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size: number | null;
  created_at: string;
}

export interface TaskReportAttachment {
  id: string;
  report_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size: number | null;
  created_at: string;
}

export interface TaskReport {
  id: string;
  task_id: string;
  submitted_by: string;
  report_text: string;
  created_at: string;
  attachments: TaskReportAttachment[];
}

export interface TaskWithAssignments extends Task {
  assignments: TaskAssignment[];
  comments: TaskComment[];
  attachments: TaskAttachment[];
  reports: TaskReport[];
  assigned_to_names?: string[];
}

function dedupeReports(rawReports: any[] = []): TaskReport[] {
  const dedup = new Map<string, TaskReport>();
  rawReports.forEach((report) => {
    if (!report) return;
    const key = [
      report.id ?? '',
      report.task_id ?? '',
      report.submitted_by ?? '',
      (report.report_text ?? '').trim(),
      report.created_at ?? '',
    ].join('|');
    const normalized: TaskReport = {
      ...report,
      attachments: (report.attachments ?? []).map((attachment: any) => ({
        ...attachment,
      })),
    };
    const existing = dedup.get(key);
    if (!existing) {
      dedup.set(key, normalized);
      return;
    }
    const existingAttachments = existing.attachments ?? [];
    const newAttachments = normalized.attachments ?? [];
    if (newAttachments.length > existingAttachments.length) {
      dedup.set(key, normalized);
    }
  });
  return Array.from(dedup.values());
}

function normalizeTask(task: any): TaskWithAssignments {
  return {
    ...task,
    attachments: task?.attachments ?? [],
    reports: dedupeReports(task?.reports ?? []),
  };
}

export interface CreateTaskData {
  org_id: string;
  room_id?: string | null;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string | null;
  assigned_to: string[];
  attachments?: Array<{
    file_name: string;
    storage_path: string;
    mime_type?: string;
    size?: number;
  }>;
}

export interface SubmitTaskReportPayload {
  task_id: string;
  report_text: string;
  attachments?: Array<{
    file_name: string;
    storage_path: string;
    mime_type?: string;
    size?: number;
  }>;
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string | null;
}

// Get all tasks for an organization
export const getTasks = async (org_id: string): Promise<TaskWithAssignments[]> => {
  const supabase = await createClient();

  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select(`
      *,
      assignments:task_assignments(*),
      comments:task_comments(*),
      attachments:task_attachments(*),
      reports:task_reports(*, attachments:task_report_attachments(*))
    `)
    .eq('org_id', org_id)
    .order('created_at', { ascending: false });

  if (tasksError) throw tasksError;
  return (tasks || []).map((task: any) => normalizeTask(task));
};

// Get tasks assigned to a specific user
export const getUserTasks = async (user_id: string, org_id: string): Promise<TaskWithAssignments[]> => {
  const supabase = await createClient();

  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select(`
      *,
      assignments:task_assignments!inner(*),
      comments:task_comments(*),
      attachments:task_attachments(*),
      reports:task_reports(*, attachments:task_report_attachments(*))
    `)
    .eq('org_id', org_id)
    .eq('task_assignments.assigned_to', user_id)
    .order('created_at', { ascending: false });

  if (tasksError) throw tasksError;
  return (tasks || []).map((task: any) => normalizeTask(task));
};

// Get tasks for a specific room
export const getRoomTasks = async (room_id: string): Promise<TaskWithAssignments[]> => {
  const supabase = await createClient();

  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select(`
      *,
      assignments:task_assignments(*),
      comments:task_comments(*),
      attachments:task_attachments(*),
      reports:task_reports(*, attachments:task_report_attachments(*))
    `)
    .eq('room_id', room_id)
    .order('created_at', { ascending: false });

  if (tasksError) throw tasksError;
  return (tasks || []).map((task: any) => normalizeTask(task));
};

// Get tasks assigned to current user in a room
export const getUserRoomTasks = async (room_id: string, user_id: string): Promise<TaskWithAssignments[]> => {
  const supabase = await createClient();

  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select(`
      *,
      assignments:task_assignments(*),
      comments:task_comments(*),
      attachments:task_attachments(*),
      reports:task_reports(*, attachments:task_report_attachments(*))
    `)
    .eq('room_id', room_id)
    .order('created_at', { ascending: false });

  if (tasksError) throw tasksError;

  const userTasks = tasks?.filter(task => 
    task.assignments.some((assignment: TaskAssignment) => assignment.assigned_to === user_id)
  ) || [];

  return userTasks.map((task: any) => normalizeTask(task));
};

// Create a new task
export const createTask = async (taskData: CreateTaskData): Promise<Task> => {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const supabase = await createClient();

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .insert([{
      org_id: taskData.org_id,
      room_id: taskData.room_id ?? null,
      title: taskData.title,
      description: taskData.description ?? null,
      priority: taskData.priority || 'medium',
      due_date: taskData.due_date ?? null,
      created_by: userId,
    }])
    .select()
    .single();

  if (taskError) throw taskError;

  if (taskData.assigned_to.length > 0) {
    const assignments = taskData.assigned_to.map(assigned_to => ({
      task_id: task.id,
      assigned_to,
      assigned_by: userId,
    }));

    const { error: assignmentError } = await supabase
      .from('task_assignments')
      .insert(assignments);

    if (assignmentError) throw assignmentError;
  }

  if (taskData.attachments && taskData.attachments.length > 0) {
    const rows = taskData.attachments.map((a) => ({
      task_id: (task as any).id,
      file_name: a.file_name,
      storage_path: a.storage_path,
      mime_type: a.mime_type ?? null,
      size: a.size ?? null,
    }))
    const { error: attError } = await supabase
      .from('task_attachments')
      .insert(rows)
    if (attError) throw attError
  }

  return task as Task;
};

export const submitTaskReport = async (payload: SubmitTaskReportPayload): Promise<TaskReport> => {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  if (!payload.report_text?.trim()) {
    throw new Error('Report text is required');
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('task_reports')
    .insert([{
      task_id: payload.task_id,
      submitted_by: userId,
      report_text: payload.report_text.trim(),
    }])
    .select()
    .single();

  if (error) throw error;
  let attachments: TaskReportAttachment[] = [];
  if (payload.attachments && payload.attachments.length > 0) {
    const rows = payload.attachments.map((attachment) => ({
      report_id: data.id,
      file_name: attachment.file_name,
      storage_path: attachment.storage_path,
      mime_type: attachment.mime_type ?? null,
      size: attachment.size ?? null,
    }));

    const { data: insertedAttachments, error: attachmentsError } = await supabase
      .from('task_report_attachments')
      .insert(rows)
      .select();

    if (attachmentsError) throw attachmentsError;
    attachments = insertedAttachments as TaskReportAttachment[];
  }

  return {
    ...(data as TaskReport),
    attachments,
  };
};

// Update a task
export const updateTask = async (taskId: string, updateData: UpdateTaskData): Promise<Task> => {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const supabase = await createClient();

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .update(updateData)
    .eq('id', taskId)
    .select()
    .single();

  if (taskError) throw taskError;
  return task as Task;
};

// Delete a task
export const deleteTask = async (taskId: string): Promise<void> => {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const supabase = await createClient();

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);

  if (error) throw error;
};

// Update task assignment status
export const updateTaskAssignmentStatus = async (
  taskId: string, 
  userId: string, 
  status: 'pending' | 'in_progress' | 'completed'
): Promise<TaskAssignment> => {
  const supabase = await createClient();

  const updateData: any = { status };
  if (status === 'completed') {
    updateData.completed_at = new Date().toISOString();
  }

  const { data: assignment, error: assignmentError } = await supabase
    .from('task_assignments')
    .update(updateData)
    .eq('task_id', taskId)
    .eq('assigned_to', userId)
    .select()
    .single();

  if (assignmentError) throw assignmentError;

  if (status === 'completed') {
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select(`
        *,
        assignments:task_assignments(*)
      `)
      .eq('id', taskId)
      .single();

    if (!taskError && task) {
      const allCompleted = task.assignments.every((a: TaskAssignment) => a.status === 'completed');
      if (allCompleted) {
        await supabase
          .from('tasks')
          .update({ status: 'completed' })
          .eq('id', taskId);
      }
    }
  }

  return assignment as TaskAssignment;
};

// Add a comment to a task
export const addTaskComment = async (taskId: string, comment: string): Promise<TaskComment> => {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const supabase = await createClient();

  const { data: taskComment, error: commentError } = await supabase
    .from('task_comments')
    .insert([{
      task_id: taskId,
      user_id: userId,
      comment,
    }])
    .select()
    .single();

  if (commentError) throw commentError;
  return taskComment as TaskComment;
};

// Get task comments
export const getTaskComments = async (taskId: string): Promise<TaskComment[]> => {
  const supabase = await createClient();

  const { data: comments, error: commentsError } = await supabase
    .from('task_comments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (commentsError) throw commentsError;
  return comments || [];
};

// Assign task to additional users
export const assignTaskToUsers = async (taskId: string, userIds: string[]): Promise<void> => {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const supabase = await createClient();

  const assignments = userIds.map(assigned_to => ({
    task_id: taskId,
    assigned_to,
    assigned_by: userId,
  }));

  const { error: assignmentError } = await supabase
    .from('task_assignments')
    .insert(assignments);

  if (assignmentError) throw assignmentError;
};

// Remove task assignment
export const removeTaskAssignment = async (taskId: string, userId: string): Promise<void> => {
  const { userId: currentUserId } = await auth();
  if (!currentUserId) throw new Error('Unauthorized');

  const supabase = await createClient();

  const { error } = await supabase
    .from('task_assignments')
    .delete()
    .eq('task_id', taskId)
    .eq('assigned_to', userId);

  if (error) throw error;
};

// Get all tasks with assignee details for admin
export const getAllTasksWithAssignees = async (org_id: string): Promise<TaskWithAssignments[]> => {
  const supabase = await createClient();

  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select(`
      *,
      assignments:task_assignments(*),
      comments:task_comments(*),
      attachments:task_attachments(*),
      reports:task_reports(*, attachments:task_report_attachments(*))
    `)
    .eq('org_id', org_id)
    .order('created_at', { ascending: false });

  if (tasksError) throw tasksError;
  return (tasks || []).map((task: any) => normalizeTask(task));
};

// Get tasks based on user role - managers see all, employees see only assigned
export const getTasksByUserRole = async (org_id: string, user_id: string, user_role: string): Promise<TaskWithAssignments[]> => {
  // If user is admin/manager, return all tasks
  if (user_role === 'org:admin' || user_role === 'admin') {
    return getAllTasksWithAssignees(org_id);
  }
  // Employees see only their tasks
  return getUserTasks(user_id, org_id);
};

// Organization members for dropdown - handled in client (Clerk)
export const getOrganizationMembers = async (_org_id: string) => {
  return [] as any[];
};

// Debug functions
export const debugAllAssignments = async () => {
  const supabase = await createClient();
  const { data: allAssignments, error } = await supabase
    .from('task_assignments')
    .select('*');
  if (error) throw error;
  return allAssignments;
};

export const debugAllTasks = async () => {
  const supabase = await createClient();
  const { data: allTasks, error } = await supabase
    .from('tasks')
    .select('*');
  if (error) throw error;
  return allTasks;
};

// Create a test task with assignment for debugging
export const createTestTaskWithAssignment = async (org_id: string, room_id: string, assignee_id: string) => {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const supabase = await createClient();

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .insert([{
      org_id: org_id,
      room_id: room_id,
      title: 'Test Task - Debug',
      description: 'This is a test task created for debugging purposes',
      priority: 'medium',
      created_by: userId,
    }])
    .select()
    .single();

  if (taskError) throw taskError;

  const { data: assignment, error: assignmentError } = await supabase
    .from('task_assignments')
    .insert([{
      task_id: task.id,
      assigned_to: assignee_id,
      assigned_by: userId,
    }])
    .select()
    .single();

  if (assignmentError) throw assignmentError;

  return { task, assignment };
};

// Get task statistics for dashboard
export const getTaskStats = async (org_id: string) => {
  const supabase = await createClient();

  const { data: stats, error: statsError } = await supabase
    .from('tasks')
    .select('status')
    .eq('org_id', org_id);

  if (statsError) throw statsError;

  const totalTasks = stats.length;
  const pendingTasks = stats.filter(task => task.status === 'pending').length;
  const inProgressTasks = stats.filter(task => task.status === 'in_progress').length;
  const completedTasks = stats.filter(task => task.status === 'completed').length;

  return {
    total: totalTasks,
    pending: pendingTasks,
    inProgress: inProgressTasks,
    completed: completedTasks,
  };
};


