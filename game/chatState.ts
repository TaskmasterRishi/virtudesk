type ChatFocusCallback = (isFocused: boolean) => void;

let isChatInputFocused: boolean = false;
const subscribers = new Set<ChatFocusCallback>();

export function setChatInputFocus(focused: boolean) {
  if (isChatInputFocused !== focused) {
    isChatInputFocused = focused;
    subscribers.forEach(cb => cb(isChatInputFocused));
  }
}

export function getChatInputFocus(): boolean {
  return isChatInputFocused;
}

export function onChatInputFocusChange(callback: ChatFocusCallback) {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}
