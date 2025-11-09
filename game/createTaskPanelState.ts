export type CreateTaskPanelCallback = (isOpen: boolean) => void;

let isCreateTaskPanelOpen = false;
const subscribers = new Set<CreateTaskPanelCallback>();

export function setCreateTaskPanelOpen(open: boolean) {
  if (isCreateTaskPanelOpen !== open) {
    isCreateTaskPanelOpen = open;
    subscribers.forEach(cb => cb(isCreateTaskPanelOpen));
  }
}

export function getCreateTaskPanelOpen(): boolean {
  return isCreateTaskPanelOpen;
}

export function onCreateTaskPanelChange(callback: CreateTaskPanelCallback) {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}
