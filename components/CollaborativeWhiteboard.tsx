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

// Type definitions to fix implicit any errors
type SceneData = {
  elements: any[];
  appState: any;
  files: Record<string, any>;
};

type Root = {
  scene: SceneData;
};

type LiveblocksUserInfo = {
  name?: string;
  color?: string;
  avatar?: string;
};

type OthersEntry = {
  connectionId: string | number;
  presence: any;
  info: LiveblocksUserInfo;
};

// Inner component that will use Liveblocks hooks
function WhiteboardContent({ onClose }: { onClose: () => void }) {
  const isUpdatingFromRemote = useRef<boolean>(false);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [currentScene, setCurrentScene] = useState<SceneData | null>(null);
  const lastSavedScene = useRef<SceneData | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Liveblocks storage and mutations
  const scene = useStorage((root: Root) => root.scene);

  // Get current user and other collaborators
  const currentUser = useSelf();
  const others = useOthers();

  // Create mutation only when ready
  const updateScene = useMutation(
    ({ storage }: { storage: { set: (key: string, value: any) => void } }, newScene: SceneData) => {
      storage.set("scene", newScene);
    },
    []
  );

  // Wait for storage to be available before allowing mutations
  useEffect(() => {
    if (scene !== undefined && scene !== null) {
      setCurrentScene(scene);
      // Reduced delay for faster loading
      const timer = setTimeout(() => {
        setIsReady(true);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [scene]);

  // Update current scene when storage changes (debounced)
  useEffect(() => {
    if (scene && !isUpdatingFromRemote.current) {
      setCurrentScene(scene);
    }
  }, [scene]);

  // Debounced save function to reduce lag
  const debouncedSave = useCallback(
    (newScene: SceneData) => {
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set new timeout
      saveTimeoutRef.current = setTimeout(() => {
        if (!isUpdatingFromRemote.current && isReady) {
          isUpdatingFromRemote.current = true;

          try {
            updateScene(newScene);
            lastSavedScene.current = newScene;
          } catch (error) {
            console.warn("Failed to update scene:", error);
          } finally {
            setTimeout(() => {
              isUpdatingFromRemote.current = false;
            }, 50); // Reduced delay
          }
        }
      }, 100); // Debounce saves by 300ms
    },
    [updateScene, isReady]
  );

  // Optimized change handler with debouncing
  const handleChange = useCallback(
    (elements: any[], appState: any, files: Record<string, any>) => {
      if (isUpdatingFromRemote.current || !isReady) return;

      const newScene: SceneData = {
        elements,
        appState: {
          ...appState,
          collaborators: undefined,
        },
        files,
      };

      // Only save if scene actually changed
      if (JSON.stringify(newScene) !== JSON.stringify(lastSavedScene.current)) {
        debouncedSave(newScene);
      }
    },
    [debouncedSave, isReady]
  );

  // Memoized collaborator info to prevent unnecessary re-renders
  const collaborators = useMemo(() => {
    // ensure "others" is an array and typecast for safety
    return (
      Array.isArray(others)
        ? others
        : Array.from(others as Iterable<OthersEntry>)
    ).map(({ connectionId, presence, info }: OthersEntry) => ({
      username: info?.name || `User ${connectionId}`,
      color: info?.color || "#ff0000",
      avatarUrl: info?.avatar || undefined,
    }));
  }, [others]);

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
            <DialogTitle className="text-2xl font-bold">Collaborative Whiteboard</DialogTitle>
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
      <DialogContent className="min-w-[90vw] h-[90vh] flex flex-col p-0 z-[1002]" style={{ zIndex: 1002 }}>
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
            transform: "none",
            borderRadius: "0.5rem",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              position: "absolute",
              top: 0,
              left: 0,
            }}
          >
            <Excalidraw
              key={currentScene ? JSON.stringify(currentScene.elements) : "empty"}
              initialData={
                currentScene || {
                  appState: { viewBackgroundColor: "#F8F9FA" },
                }
              }
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
  roomId,
}) => {
  if (!isOpen) return null;

  return (
    <RoomProvider
      id={roomId}
      initialPresence={{}}
      initialStorage={{
        scene: {
          elements: [],
          appState: { viewBackgroundColor: "#F8F9FA" },
          files: {},
        },
      }}
    >
      <WhiteboardContent onClose={onClose} />
    </RoomProvider>
  );
};

export default CollaborativeWhiteboard;