"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth, useOrganization, useUser } from "@clerk/nextjs";
import { getUserRoomTasks, getRoomTasks, type TaskWithAssignments, updateTaskAssignmentStatus, createTask, submitTaskReport, updateTask } from "@/app/actions/Tasks";
import { uploadTaskAttachments, uploadReportAttachments, type UploadedAttachment, getTaskAttachmentPublicUrl } from "@/utils/uploadTaskAttachments";
import { supabase } from "@/utils/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, PlayCircle, CheckCheck, Clock3, Tag, Users2, Paperclip, ChevronLeft, ChevronRight } from "lucide-react";
import { getAllPlayers } from "@/game/realtime/PlayerRealtime";
import { setCreateTaskPanelOpen } from "@/game/createTaskPanelState";

type Priority = 'low' | 'medium' | 'high' | 'urgent';

export default function RoomTasksPanel({ roomId }: { roomId: string; }) {
  const { orgId, orgRole } = useAuth();
  const { user } = useUser();
  const [tasks, setTasks] = useState<TaskWithAssignments[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    setCreateTaskPanelOpen(createOpen);
    return () => setCreateTaskPanelOpen(false); 
  }, [createOpen]);
  const [isOpen, setIsOpen] = useState(true);
  const { organization } = useOrganization();
  const [members, setMembers] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const isAdmin = useMemo(() => orgRole === 'org:admin' || orgRole === 'admin', [orgRole]);

  const fetchTasks = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      if (isAdmin) {
        const data = await getRoomTasks(roomId);
        setTasks(data);
      } else if (user) {
        const data = await getUserRoomTasks(roomId, user.id);
        setTasks(data);
      }
    } finally {
      setLoading(false);
    }
  }, [roomId, isAdmin, user]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  useEffect(() => {
    const loadMembers = async () => {
      if (!organization || !organization.getMemberships) return;
      try {
        const list = await organization.getMemberships();
        const arr = (list?.data || [])
          .filter((m: any) => m.publicUserData?.userId)
          .map((m: any) => ({
            id: m.publicUserData.userId as string,
            name:
              (m.publicUserData.firstName && m.publicUserData.lastName)
                ? `${m.publicUserData.firstName} ${m.publicUserData.lastName}`
                : (m.publicUserData.identifier as string) || 'Member',
            role: m.role,
          }));
        setMembers(arr);
      } catch {}
    };
    void loadMembers();
  }, [organization]);

  useEffect(() => {
    if (!roomId) return;
    let channel = supabase
      .channel(`room-tasks-${roomId}-${user?.id ?? 'guest'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `room_id=eq.${roomId}` },
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
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_assignments' },
        () => { void fetchTasks(); }
      );

    void channel.subscribe();

    return () => {
      void channel.unsubscribe();
    };
  }, [roomId, fetchTasks, user?.id]);

  return (
    <>
    <button
      onClick={() => setIsOpen(o => !o)}
      className={`fixed top-1/2 -translate-y-1/2 z-[60]
        w-8 h-16 flex items-center justify-center
        rounded-r-xl rounded-l-none
        bg-white/10 backdrop-blur-md shadow-xl
        hover:bg-white/20
        border border-white/20 border-l-0
        transition-all duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)]
        ${isOpen ? 'left-[376px]' : 'left-0'}`}
    >
      {isOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
    </button>
    <div
      className={`absolute left-4 top-1/2 -translate-y-1/2 z-60
        transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-[calc(100%+1rem)] pointer-events-none'}`}
    >
      <div
        className="relative w-[360px] max-w-[80vw]"
        onKeyDownCapture={(e) => { e.stopPropagation(); }}
        onKeyUpCapture={(e) => { e.stopPropagation(); }}
        onKeyPressCapture={(e) => { e.stopPropagation(); }}
      >
        <div className="absolute inset-0 bg-white/10 backdrop-blur-md rounded-2xl shadow-xl border border-white/20" />
        <div className={`relative overflow-hidden h-[50vh] opacity-100`}>
          <div className="flex flex-col p-3">
            <div className={`mt-0 mb-2 grid gap-2 ${isAdmin ? "grid-cols-2" : "grid-cols-1"}`}>
              <button className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition bg-slate-100 border-slate-300 text-slate-800`}>
                <Users2 className="w-4 h-4" />
                <span className="text-sm font-medium">Tasks</span>
                {tasks.length > 0 && (
                    <span 
                      className=" bg-primary text-primary-foreground text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center shadow-lg z-20"
                    >
                      {tasks.length > 9 ? '9+' : tasks.length}
                    </span>
                  )}
              </button>
              {isAdmin && (
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">New</Button>
                  </DialogTrigger>
                  <CreateRoomTaskDialog orgId={orgId || ''} roomId={roomId} members={members} onCreated={() => { setCreateOpen(false); fetchTasks(); }} />
                </Dialog>
              )}
            </div>
            <div className="bg-white border border-slate-200 rounded-md overflow-hidden flex flex-col h-[calc(50vh-72px)] p-2">
              {/* <div className="px-1 pb-2 text-xs text-muted-foreground">{loading ? 'Loading…' : `${tasks.length} tasks`}</div> */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden divide-y divide-slate-100 px-1">
                <div className="space-y-2 py-1 max-w-full">
                  {tasks.map((t) => (
                    <RoomTaskItem key={t.id} task={t} onUpdated={fetchTasks} isAdmin={isAdmin} members={members} />
                  ))}
                  {!loading && tasks.length === 0 && (
                    <Card className="p-4 text-center text-sm text-muted-foreground">No tasks yet.</Card>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>  </>
  );
}

function RoomTaskItem({ task, onUpdated, isAdmin, members }: { task: TaskWithAssignments; onUpdated: () => void; isAdmin: boolean; members: Array<{ id: string; name: string; role: string }>; }) {
  const { user } = useUser();
  const userAssignment = useMemo(() => task.assignments.find(a => a.assigned_to === user?.id), [task.assignments, user]);
  const canShowEmployeeActions = useMemo(() => !!userAssignment && !isAdmin && task.status !== 'completed', [userAssignment, isAdmin, task.status]);
  const [updating, setUpdating] = useState(false);
  const getMemberName = useCallback((userId: string) => {
    const member = members.find(m => m.id === userId);
    return member?.name ?? userId.slice(0, 8);
  }, [members]);

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

  const setStatus = async (status: 'pending' | 'in_progress' | 'completed') => {
    if (!user) return;
    setUpdating(true);
    try {
      await updateTaskAssignmentStatus(task.id, user.id, status);
      if (status === 'in_progress' && task.status !== 'in_progress') {
        await updateTask(task.id, { status: 'in_progress' });
      }
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
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="font-semibold truncate mr-2 text-sm break-words max-w-full">{task.title}</div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant="secondary" className="text-xs"><Tag className="mr-1" size={14}/>{task.priority}</Badge>
              <Badge variant="outline" className="text-xs"><Clock3 className="mr-1" size={14}/>{task.status.replace('_',' ')}</Badge>
            </div>
          </div>
          {task.description && (
            <div className="text-xs text-muted-foreground mt-1 line-clamp-2 break-words">{task.description}</div>
          )}
          {task.attachments && task.attachments.length > 0 && (
            <div className="mt-3 space-y-1">
              <div className="flex items-center text-[11px] font-semibold uppercase text-slate-400">
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
                      className="text-[11px] text-blue-600 hover:underline truncate"
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
              <div className="text-[11px] font-semibold uppercase text-slate-400">Reports</div>
              <div className="space-y-2">
                {reports.map((report) => (
                  <div key={report.id} className="rounded-md bg-slate-100/80 border border-slate-200 px-2.5 py-2 text-[11px] text-slate-700">
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>By {report.submitted_by.slice(0, 8)}…</span>
                      <span>{new Date(report.created_at).toLocaleString()}</span>
                    </div>
                    <div className="mt-1 whitespace-pre-wrap">
                      {report.report_text}
                    </div>
                    {report.attachments && report.attachments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center text-[10px] font-semibold uppercase text-slate-400">
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
                                className="text-[10px] text-blue-600 hover:underline truncate"
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
          {task.assignments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {task.assignments.map((a) => (
                <Badge key={a.id} variant="secondary" className="text-xs"><Users2 className="mr-1" size={12}/> {getMemberName(a.assigned_to)}</Badge>
              ))}
            </div>
          )}
          {task.due_date && (
            <div className="mt-2">
              <Badge variant="outline" className="text-xs">Due {new Date(task.due_date).toLocaleDateString()}</Badge>
            </div>
          )}
          {canShowEmployeeActions && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <TooltipProvider>
                {/* <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="secondary" disabled={updating} onClick={() => setStatus('in_progress')} className="gap-1"><PlayCircle size={16}/> Start</Button>
                  </TooltipTrigger>
                  <TooltipContent>Set your assignment In Progress</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1" disabled={updating} onClick={() => setStatus('completed')}><CheckCircle2 size={16}/> Done</Button>
                  </TooltipTrigger>
                  <TooltipContent>Mark your assignment Completed</TooltipContent>
                </Tooltip> */}
                {userAssignment?.status === 'pending' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="secondary" disabled={updating} onClick={() => setStatus('in_progress')} className="gap-1"><PlayCircle size={16}/> Start</Button>
                    </TooltipTrigger>
                    <TooltipContent>Set your assignment In Progress</TooltipContent>
                  </Tooltip>
                )}
                {userAssignment?.status === 'in_progress' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1" disabled={updating} onClick={() => setStatus('completed')}><CheckCircle2 size={16}/> Completed</Button>
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
                        placeholder="Share your update with the room admin."
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
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function CreateRoomTaskDialog({ orgId, roomId, onCreated, members }: { orgId: string; roomId: string; onCreated: () => void; members: Array<{ id: string; name: string; role: string }> }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>('medium');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [participants, setParticipants] = useState<Array<{ id: string; name: string }>>([]);
  const [due, setDue] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploaded, setUploaded] = useState<UploadedAttachment[]>([]);

  useEffect(() => {
    const refreshParticipants = () => {
      const list = getAllPlayers();
      const mapped = list
        .filter((p) => !!p.id)
        .map((p) => {
          const match = members.find(m => m.id === p.id);
          const displayName = match?.name || p.name || p.id.slice(0, 8);
          const role = match?.role;
          return { id: p.id, name: displayName, role };
        })
        .filter((p) => {
          const member = members.find(m => m.id === p.id);
          return member ? (member.role !== 'org:admin' && member.role !== 'admin') : true;
        });
      const prepared = mapped.map(({ id, name }) => ({ id, name }));
      setParticipants(prepared);
      console.log("participants : ", prepared);
      setAssignees((prev) => prev.filter(id => prepared.some(p => p.id === id)));
    };

    refreshParticipants();
    const interval = setInterval(refreshParticipants, 1000);
    return () => clearInterval(interval);
  }, [members]);

  const onSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      let attachments: UploadedAttachment[] = uploaded;
      if (files.length > 0) {
        attachments = await uploadTaskAttachments(orgId, files);
        setUploaded(attachments);
      }
      await createTask({ org_id: orgId, room_id: roomId, title: title.trim(), description: description.trim() || undefined, priority, assigned_to: assignees, attachments, due_date: due || null });
      onCreated();
      setTitle(""); setDescription(""); setPriority('medium'); setAssignees([]); setFiles([]); setUploaded([]); setDue("");
    } finally { setSubmitting(false); }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create Room Task</DialogTitle>
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
        <div>
          <div className="text-sm mb-1">Assign to participants</div>
          <div className="flex flex-wrap gap-2">
            {participants.map((p) => (
              <Button key={p.id} type="button" size="sm" variant={assignees.includes(p.id) ? 'default' : 'outline'} onClick={() => setAssignees(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}>
                {p.name}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCreated}>Cancel</Button>
          <Button disabled={submitting || !title.trim()} onClick={onSubmit}>Create</Button>
        </div>
      </div>
    </DialogContent>
  );
}


