'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatMessage, onChatMessage, sendChatMessage, getSelfId, getPlayerMeta } from '@/game/realtime/PlayerRealtime'
import { setChatInputFocus } from '@/game/chatState' // Import setChatInputFocus

type TextChatProps = {
  embedded?: boolean
  className?: string
  title?: string
  variant?: 'glass' | 'solid'
  roomId?: string
}

export default function TextChat({ embedded = false, className = '', title = 'Room Chat', variant = 'glass', roomId }: TextChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatBoxRef = useRef<HTMLDivElement>(null); // Ref for the chat box container
  const inputRef = useRef<HTMLInputElement>(null); // Ref for the input field
  const selfId = getSelfId()

  const storageKey = roomId ? `room-chat-${roomId}` : undefined

  const saveToStorage = useCallback((msgs: ChatMessage[]) => {
    if (!storageKey) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(msgs))
    } catch {}
  }, [storageKey])

  const loadFromStorage = useCallback(() => {
    if (!storageKey) return [] as ChatMessage[]
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return [] as ChatMessage[]
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as ChatMessage[]
      return [] as ChatMessage[]
    } catch { return [] as ChatMessage[] }
  }, [storageKey])

  useEffect(() => {
    // Load persisted messages for this room on mount
    const initial = loadFromStorage()
    if (initial.length > 0) setMessages(initial)
    const off = onChatMessage((message) => {
      setMessages((prevMessages) => {
        const next = [...prevMessages, message]
        saveToStorage(next)
        return next
      })
    })
    return () => off()
  }, [loadFromStorage, saveToStorage])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Handle clicks outside the chat box to unfocus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chatBoxRef.current && !chatBoxRef.current.contains(event.target as Node)) {
        setChatInputFocus(false);
        if (inputRef.current) {
          inputRef.current.blur(); // Programmatically blur the input
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSendMessage = useCallback(() => {
    if (newMessage.trim() && selfId) {
      const messageToSend: ChatMessage = {
        id: Math.random().toString(36).substring(2, 9),
        senderId: selfId,
        senderName: getPlayerMeta(selfId)?.name || selfId, // Get sender name from meta or use ID
        message: newMessage,
        timestamp: Date.now(),
      };
      setMessages((prevMessages) => {
        const next = [...prevMessages, messageToSend]
        saveToStorage(next)
        return next
      }); // Add to local state immediately
      sendChatMessage(newMessage);
      setNewMessage('');
    }
  }, [newMessage, selfId, saveToStorage]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSendMessage()
    }
    event.stopPropagation(); // Stop event propagation to prevent Phaser from capturing it
  }, [handleSendMessage])

  return (
    <div className={`${embedded ? '' : 'absolute bottom-4 left-4 z-50 pointer-events-auto w-80'} ${className}`}>
      <div className={`${embedded 
          ? (variant === 'solid' 
              ? 'bg-white border border-slate-200 rounded-md shadow' 
              : 'bg-white/10 backdrop-blur-md border border-white/20 rounded-xl shadow-lg')
          : 'bg-white/95 backdrop-blur border border-slate-200 rounded-md shadow-xl'} flex flex-col ${embedded ? 'h-full' : 'h-72'}`} ref={chatBoxRef}>
        <div className={`${embedded 
            ? (variant === 'solid' ? 'px-3 py-2 border-b border-slate-200 text-slate-700' : 'px-4 py-2 border-b border-white/20 text-white/90') 
            : 'p-3 border-b border-slate-200 text-slate-700'} text-sm font-semibold`}>{title}</div>
        <ScrollArea className="flex-1 p-2 overflow-y-auto">
          <div className="space-y-2">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.senderId === selfId ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-3 py-1.5 rounded-lg text-sm ${msg.senderId === selfId 
                    ? 'bg-indigo-600 text-white' 
                    : embedded 
                      ? (variant === 'solid' ? 'bg-slate-200 text-slate-800' : 'bg-white/20 text-white') 
                      : 'bg-slate-200 text-slate-800'}`}>
                  <div className="font-semibold mb-0.5">{msg.senderId === selfId ? 'You' : msg.senderName || msg.senderId}</div>
                  <div>{msg.message}</div>
                  <div className="text-xs mt-1 opacity-75">{new Date(msg.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        <div className={`p-3 flex space-x-2 ${embedded ? (variant === 'solid' ? 'border-t border-slate-200' : 'border-t border-white/20') : 'border-t border-slate-200'}`}>
          <Input
            type="text"
            placeholder="Say something..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setChatInputFocus(true)} // Set focus state on focus
            onBlur={() => setChatInputFocus(false)} // Clear focus state on blur
            className={`flex-1 ${embedded 
                ? (variant === 'solid' ? '' : 'bg-white/10 placeholder-white/60 text-white border-white/20') 
                : ''}`}
            ref={inputRef} // Attach inputRef to the input field
          />
          <Button onClick={handleSendMessage} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
