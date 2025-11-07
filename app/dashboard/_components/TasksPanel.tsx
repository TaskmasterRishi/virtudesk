"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth, useOrganization, useUser } from "@clerk/nextjs";
import { assignTaskToUsers, createTask, deleteTask, getTasksByUserRole, submitTaskReport, updateTask, updateTaskAssignmentStatus, type TaskWithAssignments } from "@/app/actions/Tasks";
import { uploadTaskAttachments, uploadReportAttachments, type UploadedAttachment, getTaskAttachmentPublicUrl } from "@/utils/uploadTaskAttachments";
import { supabase } from "@/utils/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getRooms } from "@/app/actions/Room";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, PlayCircle, Trash2, UserPlus2, Clock3, AlertTriangle, CheckCheck, Tag, LayoutList, Paperclip } from "lucide-react";

type Priority = 'low' | 'medium' | 'high' | 'urgent';
type Status = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export default function TasksPanel() {
  const { user } = useUser();
  const { orgId, orgRole } = useAuth();
  const { organization } = useOrganization();

  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<TaskWithAssignments[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [rooms, setRooms] = useState<{ id: string; title: string }[]>([]);
  const [members, setMembers] = useState<Array<{ id: string; name: string; role: string; }>>([]);

  const isAdmin = useMemo(() => orgRole === 'org:admin' || orgRole === 'admin', [orgRole]);

  const fetchTasks = useCallback(async () => {
    if (!orgId || !user) return;
    setLoading(true);
    try {
      const data = await getTasksByUserRole(orgId, user.id, orgRole || '');
      setTasks(data);
    } finally {
      setLoading(false);
    }
  }, [orgId, user, orgRole]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (!orgId) return;
    let channel = supabase
      .channel(`tasks-dashboard-${orgId}-${user?.id ?? 'guest'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `org_id=eq.${orgId}` },
        () => { void fetchTasks(); }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'task_reports' },
        () => { void fetchTasks(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_report_attachments' },
        () => { void fetchTasks(); }
      );

    if (user) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_assignments', filter: `assigned_to=eq.${user.id}` },
        () => { void fetchTasks(); }
      );
    } else {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_assignments' },
        () => { void fetchTasks(); }
      );
    }

    void channel.subscribe();

    return () => {
      void channel.unsubscribe();
    };
  }, [orgId, user?.id, fetchTasks]);

  useEffect(() => {
    const loadRooms = async () => {
      if (!orgId) return;
      try {
        const r = await getRooms(orgId);
        setRooms((r || []).map((x: any) => ({ id: x.id, title: x.title })));
      } catch {}
    };
    loadRooms();
  }, [orgId]);

  useEffect(() => {
    const load = async () => {
      if (!organization || !organization.getMemberships) return;
      try {
        const list = await organization.getMemberships();
        const arr = (list?.data || [])
          .filter((m: any) => m.publicUserData?.userId)
          .map((m: any) => ({ id: m.publicUserData.userId as string, name: (m.publicUserData.identifier as string) || 'Member', role: m.role }));
        setMembers(arr);
      } catch {}
    };
    void load();
  }, [organization]);

  return (
    <div className="fixed right-4 top-20 bottom-4 z-40 w-[360px] max-w-[80vw] pointer-events-auto">
      <Card className="h-full flex flex-col overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="font-semibold">Tasks {organization ? `· ${organization.name}` : ''}</div>
          {isAdmin && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1"><LayoutList size={16}/> New</Button>
              </DialogTrigger>
              <CreateTaskDialog orgId={orgId || ''} rooms={rooms} members={members} onCreated={() => { setCreateOpen(false); fetchTasks(); }} />
            </Dialog>
          )}
        </div>
        <div className="px-4 py-2 border-b bg-muted/30">
          <div className="text-sm text-muted-foreground">{loading ? 'Loading…' : `${tasks.length} tasks`}</div>
        </div>
        <ScrollArea className="flex-1 min-h-0 overflow-x-hidden">
          <div className="p-3 space-y-3 max-w-full">
            {tasks.map((t) => (
              <TaskItem key={t.id} task={t} canManage={!!isAdmin} onUpdated={fetchTasks} rooms={rooms} members={members} />
            ))}
            {!loading && tasks.length === 0 && (
              <Card className="p-6 text-center text-sm text-muted-foreground">No tasks yet.</Card>
            )}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}

function priorityColor(priority: Priority) {
  switch (priority) {
    case 'low': return 'bg-emerald-100 text-emerald-700';
    case 'medium': return 'bg-amber-100 text-amber-700';
    case 'high': return 'bg-orange-100 text-orange-700';
    case 'urgent': return 'bg-red-100 text-red-700';
  }
}

function statusBadge(status: Status) {
  const map: Record<Status, string> = {
    pending: 'bg-slate-100 text-slate-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-zinc-100 text-zinc-600',
  };
  return map[status];
}

function TaskItem({ task, canManage, onUpdated, rooms, members }: { task: TaskWithAssignments; canManage: boolean; onUpdated: () => void; rooms: { id: string; title: string }[], members: { id: string; name: string; role: string; }[] }) {
  const { user } = useUser();
  const userAssignment = useMemo(() => task.assignments.find(a => a.assigned_to === user?.id), [task.assignments, user]);
  const canShowEmployeeActions = useMemo(() => !!userAssignment && !canManage && task.status !== 'completed', [userAssignment, canManage, task.status]);
  const roomName = useMemo(() => {
    if (!task.room_id) return '';
    return rooms.find(r => r.id === task.room_id)?.title || task.room_id;
  }, [task.room_id, rooms]);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportFiles, setReportFiles] = useState<File[]>([]);
  const [reportUploads, setReportUploads] = useState<UploadedAttachment[]>([]);
  const reports = useMemo(() => {
    const dedup = new Map<string, TaskWithAssignments['reports'][number]>();
    (task.reports || []).forEach((report) => {
      if (!report) return;
      const key = [
        report.id ?? '',
        report.task_id ?? '',
        report.submitted_by ?? '',
        (report.report_text || '').trim(),
        report.created_at ?? '',
      ].join('|');
      const existing = dedup.get(key);
      if (!existing) {
        dedup.set(key, report);
        return;
      }
      const existingAttachments = existing.attachments ?? [];
      const newAttachments = report.attachments ?? [];
      if (newAttachments.length > existingAttachments.length) {
        dedup.set(key, { ...report, attachments: newAttachments });
      }
    });
    return Array.from(dedup.values());
  }, [task.reports]);

  const getMemberName = useCallback((userId: string) => {
    const member = members.find(m => m.id === userId);
    return member ? member.name : userId.slice(0, 8) + '…';
  }, [members]);

  const [updating, setUpdating] = useState(false);

  const changeSelfAssignmentStatus = async (status: Exclude<Status, 'cancelled'>) => {
    if (!user) return;
    setUpdating(true);
    try {
      await updateTaskAssignmentStatus(task.id, user.id, status as any);
      if (status === 'in_progress' && task.status !== 'in_progress') {
        await updateTask(task.id, { status: 'in_progress' });
      }
      onUpdated();
    } finally {
      setUpdating(false);
    }
  };

  const onDelete = async () => {
    setUpdating(true);
    try {
      await deleteTask(task.id);
      onUpdated();
    } finally {
      setUpdating(false);
    }
  };

  const onSubmitReport = async () => {
    if (!reportText.trim()) {
      setReportError('Please enter a brief report before submitting.');
      return;
    }
    setReportSubmitting(true);
    setReportError(null);
    try {
      let attachments: UploadedAttachment[] = [];
      if (reportFiles.length > 0) {
        attachments = await uploadReportAttachments(task.org_id, task.id, reportFiles);
        setReportUploads(attachments);
      }
      await submitTaskReport({ task_id: task.id, report_text: reportText, attachments });
      setReportText('');
      setReportFiles([]);
      setReportUploads([]);
      setReportOpen(false);
      onUpdated();
    } catch (error: any) {
      setReportError(error?.message || 'Failed to submit report');
    } finally {
      setReportSubmitting(false);
    }
  };

  return (
    <Card className="p-4 w-full overflow-hidden">
      <div className="flex items-start gap-3 min-w-0">
        <div className={cn("w-2 h-2 mt-1.5 rounded-full flex-shrink-0", task.status === 'completed' ? 'bg-green-500' : task.status === 'in_progress' ? 'bg-blue-500' : 'bg-slate-300')} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="font-semibold truncate mr-2 break-words max-w-full">{task.title}</div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge className={priorityColor(task.priority)}><Tag className="mr-1" size={14}/>{task.priority}</Badge>
              <Badge className={statusBadge(task.status)}><Clock3 className="mr-1" size={14}/>{task.status.replace('_', ' ')}</Badge>
            </div>
          </div>
          {task.description && (
            <div className="text-sm text-muted-foreground mt-1 line-clamp-2 break-words">{task.description}</div>
          )}
          {task.attachments && task.attachments.length > 0 && (
            <div className="mt-3 space-y-1">
              <div className="flex items-center text-xs font-semibold uppercase text-slate-400">
                <Paperclip className="mr-1 h-3 w-3" /> Attachments
              </div>
              <div className="flex flex-col gap-1">
                {task.attachments.map((attachment) => {
                  const href = getTaskAttachmentPublicUrl(attachment.storage_path)
                  return (
                    <a
                      key={attachment.id}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline truncate"
                    >
                      {attachment.file_name}
                    </a>
                  )
                })}
              </div>
            </div>
          )}
          {reports.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="text-xs font-semibold uppercase text-slate-400">Reports</div>
              <div className="space-y-2">
                {reports.map((report) => (
                  <div key={report.id} className="rounded-md bg-slate-100/80 border border-slate-200 px-3 py-2 text-xs text-slate-700">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>By {report.submitted_by.slice(0, 8)}…</span>
                      <span>{new Date(report.created_at).toLocaleString()}</span>
                    </div>
                    <div className="mt-1 whitespace-pre-wrap">
                      {report.report_text}
                    </div>
                    {report.attachments && report.attachments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center text-[11px] font-semibold uppercase text-slate-400">
                          <Paperclip className="mr-1 h-3 w-3" /> Files
                        </div>
                        <div className="flex flex-col gap-1">
                          {report.attachments.map((attachment) => {
                            const href = getTaskAttachmentPublicUrl(attachment.storage_path)
                            return (
                              <a
                                key={attachment.id}
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-blue-600 hover:underline truncate"
                              >
                                {attachment.file_name}
                              </a>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {task.assignments.map((a) => (
              <Badge key={a.id} variant="secondary" className="text-xs"><UserPlus2 className="mr-1" size={12}/> {getMemberName(a.assigned_to)}…</Badge>
            ))}
            {task.due_date && <Badge variant="outline" className="text-xs">Due {new Date(task.due_date).toLocaleDateString()}</Badge>}
            {task.room_id && <Badge variant="outline" className="text-xs">Room {roomName}</Badge>}
          </div>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {canShowEmployeeActions && (
              <TooltipProvider>
                {userAssignment?.status === 'pending' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="secondary" disabled={updating} onClick={() => changeSelfAssignmentStatus('in_progress')} className="gap-1"><PlayCircle size={16}/> Start</Button>
                    </TooltipTrigger>
                    <TooltipContent>Set your assignment In Progress</TooltipContent>
                  </Tooltip>
                )}
                {userAssignment?.status === 'in_progress' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1" disabled={updating} onClick={() => changeSelfAssignmentStatus('completed')}><CheckCircle2 size={16}/> Completed</Button>
                    </TooltipTrigger>
                    <TooltipContent>Mark your assignment Completed</TooltipContent>
                  </Tooltip>
                )}
                <Dialog open={reportOpen} onOpenChange={(open) => { setReportOpen(open); if (!open) setReportError(null); }}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1"><Paperclip size={16}/> Submit report</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Submit Task Report</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <textarea
                        value={reportText}
                        onChange={(e) => setReportText(e.target.value)}
                        rows={5}
                        placeholder="Share progress, blockers, or final notes for this task."
                        onKeyDown={(e) => { e.stopPropagation(); (e.nativeEvent as any)?.stopImmediatePropagation?.(); }}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <div className="space-y-2">
                        <input
                          type="file"
                          multiple
                          onChange={(e) => setReportFiles(Array.from(e.target.files || []))}
                          className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                        />
                        {(reportFiles.length > 0 || reportUploads.length > 0) && (
                          <div className="max-h-24 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
                            <ul className="space-y-1">
                              {reportUploads.map((upload, index) => (
                                <li key={`uploaded-${index}`} className="flex items-center justify-between">
                                  <span className="truncate mr-2">{upload.file_name}</span>
                                  <span className="text-slate-400">uploaded</span>
                                </li>
                              ))}
                              {reportFiles.map((file, index) => (
                                <li key={`pending-${index}`} className="flex items-center justify-between">
                                  <span className="truncate mr-2">{file.name}</span>
                                  <button
                                    type="button"
                                    className="text-red-600"
                                    onClick={() => setReportFiles((prev) => prev.filter((_, idx) => idx !== index))}
                                  >
                                    remove
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      {reportError && <p className="text-xs text-red-600">{reportError}</p>}
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button>
                        <Button onClick={onSubmitReport} disabled={reportSubmitting}>
                          {reportSubmitting ? 'Submitting…' : 'Submit report'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </TooltipProvider>
            )}
            {canManage && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="destructive" disabled={updating} onClick={onDelete} className="gap-1"><Trash2 size={16}/> Delete</Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete task</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function CreateTaskDialog({ orgId, rooms, roomId, onCreated, members: allMembers }: { orgId: string; rooms?: { id: string; title: string }[]; roomId?: string; onCreated: () => void; members: Array<{ id: string; name: string; role: string; }> }) {
  const { user } = useUser();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>('medium');
  const [due, setDue] = useState<string>("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [room, setRoom] = useState<string | undefined>(roomId);
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploaded, setUploaded] = useState<UploadedAttachment[]>([]);

  const members = useMemo(() => {
    if (!allMembers) return [];
    return allMembers.filter(m => m.role !== 'org:admin');
  }, [allMembers]);

  console.log(members);

  const onSubmit = async () => {
    if (!user || !orgId || !title.trim()) return;
    setSubmitting(true);
    try {
      // upload attachments first (optional)
      let attachments: UploadedAttachment[] = uploaded;
      if (files.length > 0) {
        attachments = await uploadTaskAttachments(orgId, files);
        setUploaded(attachments);
      }
      await createTask({
        org_id: orgId,
        room_id: roomId ? roomId : (room || null),
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        due_date: due || null,
        assigned_to: assignees,
        attachments,
      });
      onCreated();
      setTitle(""); setDescription(""); setPriority('medium'); setDue(""); setAssignees([]); setFiles([]); setUploaded([]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create Task</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="flex gap-2">
          <select className="w-1/2 border rounded-md px-2 py-2 text-sm" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <div className="space-y-2">
          <div className="text-sm mb-1">Attachments</div>
          <input
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
          />
          {(files.length > 0 || uploaded.length > 0) && (
            <div className="max-h-28 overflow-auto border rounded-md p-2 text-xs text-slate-700 bg-slate-50">
              <ul className="space-y-1">
                {uploaded.map((u, i) => (
                  <li key={`u-${i}`} className="flex items-center justify-between">
                    <span className="truncate mr-2">{u.file_name}</span>
                    <span className="text-slate-400">uploaded</span>
                  </li>
                ))}
                {files.map((f, i) => (
                  <li key={`f-${i}`} className="flex items-center justify-between">
                    <span className="truncate mr-2">{f.name}</span>
                    <button type="button" className="text-red-600" onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}>remove</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {!roomId && rooms && rooms.length > 0 && (
          <div>
            <div className="text-sm mb-1">Assign to room</div>
            <div className="flex flex-wrap gap-2">
              {rooms.map((r) => (
                <Button key={r.id} type="button" size="sm" variant={room === r.id ? 'default' : 'outline'} onClick={() => setRoom(prev => prev === r.id ? undefined : r.id)}>
                  {r.title}
                </Button>
              ))}
            </div>
          </div>
        )}
        <div>
          <div className="text-sm mb-1">Assign to participants</div>
          <div className="flex flex-wrap gap-2">
          {members.map((m) => (
              <Button key={m.id} type="button" variant={assignees.includes(m.id) ? 'default' : 'outline'} size="sm" onClick={() => setAssignees((prev) => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id])}>
                {m.name}
              </Button>
            ))}
          </div>
        </div>
        <Separator />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCreated}><AlertTriangle className="mr-1" size={16}/> Cancel</Button>
          <Button disabled={submitting || !title.trim()} onClick={onSubmit}>Create</Button>
        </div>
      </div>
    </DialogContent>
  );
}