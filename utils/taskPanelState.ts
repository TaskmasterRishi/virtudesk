let isTaskPanelOpen = false;
const subscribers = new Set<(open: boolean) => void>();

export function setTaskPanelOpen(open: boolean) {
  isTaskPanelOpen = open;
  subscribers.forEach(cb => cb(open));
}

export function getTaskPanelOpen() {
  return isTaskPanelOpen;
}

export function onTaskPanelChange(cb: (open: boolean) => void): () => void {
    subscribers.add(cb);
    return () => {              
      subscribers.delete(cb);   
    };
  }