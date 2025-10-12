'use client';

import React, { useEffect, useRef } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import '@excalidraw/excalidraw/index.css';

export interface WhiteboardProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

const Whiteboard: React.FC<WhiteboardProps> = ({ isOpen, onClose, roomId }) => {
  const excalidrawWrapperRef = useRef<HTMLDivElement>(null);

  // 🩵 Fix: Force Excalidraw to re-calculate canvas bounds after open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 300); // Give it 300ms for dialog animation/layout to settle
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="min-w-[90vw] h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4">
          <DialogTitle className="text-2xl font-bold">Collaborative Whiteboard</DialogTitle>
        </DialogHeader>

        <div
          ref={excalidrawWrapperRef}
          className="flex-1 border w-full h-full relative"
          style={{
            padding: 0,
            margin: 0,
            transform: 'none',
            borderRadius: '0.5rem',
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          >
            <Excalidraw
              initialData={{
                appState: { viewBackgroundColor: '#F8F9FA' },
              }}
              UIOptions={{
                canvasActions: { clearCanvas: true },
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Whiteboard;
