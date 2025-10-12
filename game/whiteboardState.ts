let isWhiteboardOpen = false;

export function setWhiteboardOpen(isOpen: boolean) {
  isWhiteboardOpen = isOpen;
}

export function getWhiteboardOpen(): boolean {
  return isWhiteboardOpen;
}
