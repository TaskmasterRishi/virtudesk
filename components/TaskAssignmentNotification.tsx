"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/utils/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@clerk/nextjs";
import { setTaskPanelOpen } from "@/utils/taskPanelState";

type AssignmentPayload = {
  id: string;
  task_id: string;
  assigned_to: string;
  assigned_by: string;
};

export default function TaskAssignmentNotification() {
  const { user } = useUser();
  const { organization } = useOrganization();
  const [assignedByName, setAssignedByName] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<AssignmentPayload | null>(null);
  const [taskTitle, setTaskTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('task-assignments')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_assignments', filter: `assigned_to=eq.${user.id}` }, (e: any) => {
        setPayload({ id: e.new.id, task_id: e.new.task_id, assigned_to: e.new.assigned_to, assigned_by: e.new.assigned_by });
        setOpen(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    async function load() {
      if (!payload?.assigned_by || !organization?.getMemberships) return;
      const list = await organization.getMemberships();
      const match = list.data.find(
        (m: any) => m.publicUserData?.userId === payload.assigned_by
      );
      if (!match) return;
      const first = match.publicUserData?.firstName;
      const last = match.publicUserData?.lastName;
      setAssignedByName(
        first || last
          ? `${first ?? ""} ${last ?? ""}`.trim()
          : match.publicUserData?.identifier.split("@")[0] || ""
      );
    }
    load();
  }, [payload, organization]);
  
  useEffect(() => {
    let aborted = false;
    async function loadTask() {
      if (!payload?.task_id) return;
      const { data } = await supabase
        .from("tasks")
        .select("title")
        .eq("id", payload.task_id)
        .single();
      if (!aborted) setTaskTitle(data?.title ?? null);
    }
    loadTask();
    return () => { aborted = true; };
  }, [payload?.task_id]);

  if (!payload) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Task Assigned</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">You have been assigned a new task.</p>
          <div className="text-sm"><span className="font-medium">Task {taskTitle ? '' : 'ID'} :</span> {taskTitle ?? `#${payload.task_id.slice(0, 8)}…`}</div>
          <div className="text-sm"><span className="font-medium">Assigned By :</span> {assignedByName || payload.assigned_by.slice(0,8) + '…'}</div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Dismiss</Button>
            <Button onClick={() => {setOpen(false);setTaskPanelOpen(true);}}>View</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


