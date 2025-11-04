"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth, useOrganization, useUser } from "@clerk/nextjs";
import { assignTaskToUsers, createTask, deleteTask, getTasksByUserRole, updateTask, updateTaskAssignmentStatus, type TaskWithAssignments } from "@/app/actions/Tasks";
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
import { CheckCircle2, PlayCircle, Trash2, UserPlus2, Clock3, AlertTriangle, CheckCheck, Tag, LayoutList } from "lucide-react";

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
    const loadRooms = async () => {
      if (!orgId) return;
      try {
        const r = await getRooms(orgId);
        setRooms((r || []).map((x: any) => ({ id: x.id, title: x.title })));
      } catch {}
    };
    loadRooms();
  }, [orgId]);

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
              <CreateTaskDialog orgId={orgId || ''} rooms={rooms} onCreated={() => { setCreateOpen(false); fetchTasks(); }} />
            </Dialog>
          )}
        </div>
        <div className="px-4 py-2 border-b bg-muted/30">
          <div className="text-sm text-muted-foreground">{loading ? 'Loading…' : `${tasks.length} tasks`}</div>
        </div>
        <ScrollArea className="flex-1 min-h-0 overflow-x-hidden">
          <div className="p-3 space-y-3 max-w-full">
            {tasks.map((t) => (
              <TaskItem key={t.id} task={t} canManage={!!isAdmin} onUpdated={fetchTasks} />
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

function TaskItem({ task, canManage, onUpdated }: { task: TaskWithAssignments; canManage: boolean; onUpdated: () => void; }) {
  const { user } = useUser();
  const isAssignee = useMemo(() => task.assignments.some(a => a.assigned_to === user?.id), [task.assignments, user]);

  const [updating, setUpdating] = useState(false);

  const changeStatus = async (status: Status) => {
    setUpdating(true);
    try {
      await updateTask(task.id, { status });
      onUpdated();
    } finally {
      setUpdating(false);
    }
  };

  const changeSelfAssignmentStatus = async (status: Exclude<Status, 'cancelled'>) => {
    if (!user) return;
    setUpdating(true);
    try {
      await updateTaskAssignmentStatus(task.id, user.id, status as any);
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
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {task.assignments.map((a) => (
              <Badge key={a.id} variant="secondary" className="text-xs"><UserPlus2 className="mr-1" size={12}/> {a.assigned_to.slice(0, 8)}…</Badge>
            ))}
            {task.due_date && <Badge variant="outline" className="text-xs">Due {new Date(task.due_date).toLocaleDateString()}</Badge>}
            {task.room_id && <Badge variant="outline" className="text-xs">Room {task.room_id}</Badge>}
          </div>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {isAssignee && task.status !== 'completed' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="secondary" disabled={updating} onClick={() => changeSelfAssignmentStatus('in_progress')} className="gap-1"><PlayCircle size={16}/> Start</Button>
                  </TooltipTrigger>
                  <TooltipContent>Set your assignment In Progress</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1" disabled={updating} onClick={() => changeSelfAssignmentStatus('completed')}><CheckCircle2 size={16}/> Done</Button>
                  </TooltipTrigger>
                  <TooltipContent>Mark your assignment Completed</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {canManage && (
              <TooltipProvider>
                <TaskAssignSmall taskId={task.id} onAssigned={onUpdated} />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline" disabled={updating} onClick={() => changeStatus('in_progress')} className="gap-1"><Clock3 size={16}/> In progress</Button>
                  </TooltipTrigger>
                  <TooltipContent>Set task In Progress</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline" disabled={updating} onClick={() => changeStatus('completed')} className="gap-1"><CheckCheck size={16}/> Complete</Button>
                  </TooltipTrigger>
                  <TooltipContent>Mark task Completed</TooltipContent>
                </Tooltip>
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

function CreateTaskDialog({ orgId, rooms, roomId, onCreated }: { orgId: string; rooms?: { id: string; title: string }[]; roomId?: string; onCreated: () => void; }) {
  const { user } = useUser();
  const { organization } = useOrganization();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>('medium');
  const [due, setDue] = useState<string>("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [room, setRoom] = useState<string | undefined>(roomId);
  const [submitting, setSubmitting] = useState(false);
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!organization || !organization.getMemberships) return;
      setLoadingMembers(true);
      try {
        const list = await organization.getMemberships();
        const arr = (list?.data || [])
          .filter((m: any) => m.role !== 'org:admin' && m.publicUserData?.userId)
          .map((m: any) => ({ id: m.publicUserData.userId as string, name: (m.publicUserData.identifier as string) || 'Member' }));
        setMembers(arr);
      } finally {
        setLoadingMembers(false);
      }
    };
    void load();
  }, [organization]);

  

  const onSubmit = async () => {
    if (!user || !orgId || !title.trim()) return;
    setSubmitting(true);
    try {
      await createTask({
        org_id: orgId,
        room_id: roomId ? roomId : (room || null),
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        due_date: due || null,
        assigned_to: assignees,
      });
      onCreated();
      setTitle(""); setDescription(""); setPriority('medium'); setDue(""); setAssignees([]);
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
            {loadingMembers && <span className="text-xs text-muted-foreground">Loading members…</span>}
            {!loadingMembers && members.map((m) => (
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

function TaskAssignSmall({ taskId, onAssigned }: { taskId: string; onAssigned: () => void; }) {
  const { organization } = useOrganization();
  const [assigning, setAssigning] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!organization || !organization.getMemberships) return;
      setLoadingMembers(true);
      try {
        const list = await organization.getMemberships();
        const arr = (list?.data || [])
          .filter((m: any) => m.role !== 'org:admin' && m.publicUserData?.userId)
          .map((m: any) => ({ id: m.publicUserData.userId as string, name: (m.publicUserData.identifier as string) || 'Member' }));
        setMembers(arr);
      } finally {
        setLoadingMembers(false);
      }
    };
    void load();
  }, [organization]);

  const onAssign = async () => {
    if (selected.length === 0) return;
    setAssigning(true);
    try {
      await assignTaskToUsers(taskId, selected);
      onAssigned();
      setSelected([]);
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1"><UserPlus2 size={16}/> Assign</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {loadingMembers && <span className="text-xs text-muted-foreground">Loading members…</span>}
            {!loadingMembers && members.map((m) => (
              <Button key={m.id} type="button" variant={selected.includes(m.id) ? 'default' : 'outline'} size="sm" onClick={() => setSelected((prev) => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id])}>
                {m.name}
              </Button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline">Close</Button>
            <Button disabled={assigning || selected.length === 0} onClick={onAssign}>Assign</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


