'use client';

import React, { useRef, useCallback, useEffect, useState, useMemo } from "react";
import { RoomProvider, useStorage, useMutation, useSelf, useOthers } from "@liveblocks/react";
import { Excalidraw } from "@excalidraw/excalidraw";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import '@excalidraw/excalidraw/index.css';

export interface CollaborativeWhiteboardProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

// Inner component that will use Liveblocks hooks
function WhiteboardContent({ onClose }: { onClose: () => void }) {
  const isUpdatingFromRemote = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [currentScene, setCurrentScene] = useState<any>(null);
  const lastSavedScene = useRef<any>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const changeCountRef = useRef(0);
  const lastChangeTimeRef = useRef(0);

  // Liveblocks storage and mutations
  const scene = useStorage((root) => root.scene);
  
  // Get current user and other collaborators
  const currentUser = useSelf();
  const others = useOthers();

  // Create mutation only when ready
  const updateScene = useMutation(({ storage }, newScene) => {
    storage.set("scene", newScene);
  }, []);

  // Wait for storage to be available before allowing mutations
  useEffect(() => {
    if (scene !== undefined) {
      setCurrentScene(scene);
      // Ultra-fast loading
      const timer = setTimeout(() => {
        setIsReady(true);
      }, 50);
      
      return () => clearTimeout(timer);
    }
  }, [scene]);

  // Update current scene when storage changes (throttled)
  useEffect(() => {
    if (scene && !isUpdatingFromRemote.current) {
      setCurrentScene(scene);
    }
  }, [scene]);

  // Advanced debounced save with adaptive timing
  const adaptiveSave = useCallback((newScene: any) => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const now = Date.now();
    const timeSinceLastChange = now - lastChangeTimeRef.current;
    lastChangeTimeRef.current = now;
    changeCountRef.current++;

    // Adaptive debounce timing based on change frequency
    let debounceTime = 300;
    if (changeCountRef.current > 10 && timeSinceLastChange < 100) {
      // High frequency changes - longer debounce
      debounceTime = 500;
    } else if (changeCountRef.current < 3 && timeSinceLastChange > 200) {
      // Low frequency changes - shorter debounce
      debounceTime = 150;
    }

    // Set new timeout with adaptive timing
    saveTimeoutRef.current = setTimeout(() => {
      if (!isUpdatingFromRemote.current && isReady) {
        isUpdatingFromRemote.current = true;
        
        try {
          updateScene(newScene);
          lastSavedScene.current = newScene;
          changeCountRef.current = 0; // Reset counter after successful save
        } catch (error) {
          console.warn("Failed to update scene:", error);
        } finally {
          setTimeout(() => {
            isUpdatingFromRemote.current = false;
          }, 25); // Ultra-fast update delay
        }
      }
    }, debounceTime);
  }, [updateScene, isReady]);

  // Ultra-optimized change handler
  const handleChange = useCallback((elements: any, appState: any, files: any) => {
    if (isUpdatingFromRemote.current || !isReady) return;
    
    // Quick shallow comparison for performance
    const newScene = {
      elements,
      appState: { 
        ...appState, 
        collaborators: undefined
      },
      files,
    };
    
    // Fast comparison - only check elements length and first few elements
    const hasSignificantChange = 
      !lastSavedScene.current ||
      lastSavedScene.current.elements?.length !== elements.length ||
      (elements.length > 0 && lastSavedScene.current.elements?.[0]?.id !== elements[0]?.id);
    
    if (hasSignificantChange) {
      adaptiveSave(newScene);
    }
  }, [adaptiveSave, isReady]);

  // Memoized collaborator info with deep comparison
  const collaborators = useMemo(() => {
    return others.map(({ connectionId, presence, info }) => ({
      username: info?.name || `User ${connectionId}`,
      color: info?.color || "#ff0000",
      avatarUrl: info?.avatar || undefined,
    }));
  }, [others.length, others.map(o => o.connectionId).join(',')]);

  // Memoized scene key for minimal re-renders
  const sceneKey = useMemo(() => {
    if (!currentScene) return 'empty';
    // Only use elements count and first element ID for key
    const elementsCount = currentScene.elements?.length || 0;
    const firstElementId = currentScene.elements?.[0]?.id || '';
    return `${elementsCount}-${firstElementId}`;
  }, [currentScene?.elements?.length, currentScene?.elements?.[0]?.id]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Show loading state until ready
  if (!isReady) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="min-w-[90vw] h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-4">
            <DialogTitle className="text-2xl font-bold">
              Collaborative Whiteboard
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-lg text-gray-500">Connecting to room...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="min-w-[90vw] h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4">
          <DialogTitle className="text-2xl font-bold">
            Collaborative Whiteboard
            {others.length > 0 && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({others.length + 1} users)
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div
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
              key={sceneKey}
              initialData={currentScene || {
                appState: { viewBackgroundColor: '#F8F9FA' },
              }}
              onChange={handleChange}
              UIOptions={{
                canvasActions: { clearCanvas: true },
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Main component with RoomProvider
const CollaborativeWhiteboard: React.FC<CollaborativeWhiteboardProps> = ({ 
  isOpen, 
  onClose, 
  roomId 
}) => {
  if (!isOpen) return null;

  return (
    <RoomProvider 
      id={roomId} 
      initialPresence={{}} 
      initialStorage={{ 
        scene: {
          elements: [],
          appState: { viewBackgroundColor: '#F8F9FA' },
          files: {}
        }
      }}
    >
      <WhiteboardContent onClose={onClose} />
    </RoomProvider>
  );
};

export default CollaborativeWhiteboard;