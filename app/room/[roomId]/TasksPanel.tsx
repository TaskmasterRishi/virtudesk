"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { getUserRoomTasks, getRoomTasks, type TaskWithAssignments, updateTaskAssignmentStatus, createTask } from "@/app/actions/Tasks";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, PlayCircle, CheckCheck, Clock3, Tag, Users2 } from "lucide-react";
import { getAllPlayers } from "@/game/realtime/PlayerRealtime";

type Priority = 'low' | 'medium' | 'high' | 'urgent';

export default function RoomTasksPanel({ roomId }: { roomId: string; }) {
  const { orgId, orgRole } = useAuth();
  const { user } = useUser();
  const [tasks, setTasks] = useState<TaskWithAssignments[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

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

  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-50 pointer-events-auto">
      <div className="relative w-[360px] max-w-[80vw]">
        <div className="absolute inset-0 bg-white/10 backdrop-blur-md rounded-2xl shadow-xl border border-white/20" />
        <div className={`relative overflow-hidden h-[50vh] opacity-100`}>
          <div className="flex flex-col p-3">
            <div className="mt-0 mb-2 grid grid-cols-2 gap-2">
              <button className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition bg-slate-100 border-slate-300 text-slate-800`}>
                <Users2 className="w-4 h-4" />
                <span className="text-sm font-medium">Tasks</span>
              </button>
              {isAdmin && (
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">New</Button>
                  </DialogTrigger>
                  <CreateRoomTaskDialog orgId={orgId || ''} roomId={roomId} onCreated={() => { setCreateOpen(false); fetchTasks(); }} />
                </Dialog>
              )}
            </div>
            <div className="bg-white border border-slate-200 rounded-md overflow-hidden flex flex-col h-[calc(50vh-72px)] p-2">
              <div className="px-1 pb-2 text-xs text-muted-foreground">{loading ? 'Loading…' : `${tasks.length} tasks`}</div>
              <div className="flex-1 overflow-y-auto overflow-x-hidden divide-y divide-slate-100 px-1">
                <div className="space-y-2 py-1 max-w-full">
                  {tasks.map((t) => (
                    <RoomTaskItem key={t.id} task={t} onUpdated={fetchTasks} />
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
    </div>
  );
}

function RoomTaskItem({ task, onUpdated }: { task: TaskWithAssignments; onUpdated: () => void; }) {
  const { user } = useUser();
  const isAssignee = task.assignments.some(a => a.assigned_to === user?.id);
  const [updating, setUpdating] = useState(false);

  const setStatus = async (status: 'pending' | 'in_progress' | 'completed') => {
    if (!user) return;
    setUpdating(true);
    try {
      await updateTaskAssignmentStatus(task.id, user.id, status);
      onUpdated();
    } finally {
      setUpdating(false);
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
          {isAssignee && task.status !== 'completed' && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <TooltipProvider>
                <Tooltip>
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
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function CreateRoomTaskDialog({ orgId, roomId, onCreated }: { orgId: string; roomId: string; onCreated: () => void; }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>('medium');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [participants, setParticipants] = useState<Array<{ id: string; name?: string; avatar?: string }>>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const list = getAllPlayers();
    setParticipants(list);
  }, []);

  const onSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await createTask({ org_id: orgId, room_id: roomId, title: title.trim(), description: description.trim() || undefined, priority, assigned_to: assignees });
      onCreated();
      setTitle(""); setDescription(""); setPriority('medium'); setAssignees([]);
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
        </div>
        <div>
          <div className="text-sm mb-1">Assign to participants</div>
          <div className="flex flex-wrap gap-2">
            {participants.map((p) => (
              <Button key={p.id} type="button" size="sm" variant={assignees.includes(p.id) ? 'default' : 'outline'} onClick={() => setAssignees(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}>
                {p.name || p.id.slice(0,8)}
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


