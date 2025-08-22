import React, { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import Link from "next/link";
import { Edit, Trash2, Loader2, Check, X, ExternalLink } from "lucide-react";
import { Rooms } from "../page";
import { useRoomStore } from "@/app/stores/roomStore";

const RoomCard = ({
  id,
  imageUrl,
  title,
  created_at,
  author_name,
  org,
  index,
}: Pick<Rooms, "id" | "imageUrl" | "title" | "created_at" | "author_name"> & {
  org: string;
  index: number;
}) => {
  const { deleteRoom, renameRoom } = useRoomStore();
  const [isEditing, setIsEditing] = useState(false);
  const [newTitle, setNewTitle] = useState(title);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  const handleEdit = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isEditing) {
      if (newTitle.trim() === title) {
        setIsEditing(false);
        return;
      }
      setIsRenaming(true);
      try {
        await renameRoom(id, newTitle);
        setIsEditing(false);
      } finally {
        setIsRenaming(false);
      }
    } else {
      setIsEditing(true);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this room?")) {
      setIsDeleting(true);
      try {
        await deleteRoom(id);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleKeyPress = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setIsRenaming(true);
      try {
        await renameRoom(id, newTitle);
        setIsEditing(false);
      } finally {
        setIsRenaming(false);
      }
    } else if (e.key === "Escape") {
      setNewTitle(title);
      setIsEditing(false);
    }
  };

  const handleBlur = async () => {
    if (newTitle.trim() !== title) {
      setIsRenaming(true);
      try {
        await renameRoom(id, newTitle);
        setIsEditing(false);
      } finally {
        setIsRenaming(false);
      }
    } else {
      setIsEditing(false);
    }
  };

  const handleSave = async () => {
    if (newTitle.trim() === title) {
      setIsEditing(false);
      return;
    }
    setIsRenaming(true);
    try {
      await renameRoom(id, newTitle);
      setIsEditing(false);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleCancel = () => {
    setNewTitle(title);
    setIsEditing(false);
  };

  return (
    <div className="relative group">
      <motion.div
        className="w-[250px] border rounded-lg overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.3,
        }}
        whileHover={{
          scale: 1.03,
          boxShadow: "0 10px 20px rgba(0,0,0,0.1)",
        }}
      >
        <motion.div
          className="p-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.1 + 0.1 }}
        >
          <div className="relative w-full aspect-square bg-gray-100">
            <Link
              href={`/room/${id}`}
              className="p-2 bg-primary text-white rounded-full shadow-md hover:bg-primary/90 transition-colors"
              title="Open room"
            >
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt="Room thumbnail"
                  fill
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full bg-gray-200">
                  <span className="text-gray-500">No Image</span>
                </div>
              )}
            </Link>
          </div>
        </motion.div>

        <motion.div
          className="p-4 space-y-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.1 + 0.2 }}
        >
          <motion.h3
            className="text-lg font-semibold"
            initial={{ x: -10 }}
            animate={{ x: 0 }}
            transition={{ delay: index * 0.1 + 0.3 }}
          >
            {isEditing ? (
              <div className="relative">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={handleKeyPress}
                  onBlur={handleBlur}
                  className="w-full px-3 pr-16 py-2 rounded-md border border-gray-200 bg-white/80 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition"
                  autoFocus
                  disabled={isRenaming}
                  placeholder="Enter room name"
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {isRenaming ? (
                    <Loader2 size={16} className="animate-spin text-blue-500" />
                  ) : (
                    <>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleSave}
                        className="p-1.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition"
                        aria-label="Save"
                        title="Save"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleCancel}
                        className="p-1.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-600 transition"
                        aria-label="Cancel"
                        title="Cancel"
                      >
                        <X size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              title
            )}
          </motion.h3>
          <motion.p
            className="text-sm text-gray-500"
            initial={{ x: -10 }}
            animate={{ x: 0 }}
            transition={{ delay: index * 0.1 + 0.4 }}
          >
            Created: {new Date(created_at).toLocaleDateString()}
          </motion.p>
          <motion.p
            className="text-sm text-gray-500"
            initial={{ x: -10 }}
            animate={{ x: 0 }}
            transition={{ delay: index * 0.1 + 0.5 }}
          >
            By: {author_name}
          </motion.p>
          <motion.p
            className="text-sm text-gray-500"
            initial={{ x: -10 }}
            animate={{ x: 0 }}
            transition={{ delay: index * 0.1 + 0.6 }}
          >
            {org}
          </motion.p>
        </motion.div>
      </motion.div>
      
      {/* Action Icons (edit/delete only) */}
      <div className="absolute bottom-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <motion.button
          onClick={handleEdit}
          disabled={isDeleting || isRenaming}
          className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          whileHover={{ scale: isDeleting || isRenaming ? 1 : 1.1 }}
          whileTap={{ scale: isDeleting || isRenaming ? 1 : 0.95 }}
          title={isEditing ? "Save name" : "Edit room name"}
        >
          {isRenaming ? (
            <Loader2 size={16} className="animate-spin text-blue-500" />
          ) : (
            <Edit size={16} className="text-gray-700" />
          )}
        </motion.button>
        <motion.button
          onClick={handleDelete}
          disabled={isDeleting || isRenaming}
          className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-red-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          whileHover={{ scale: isDeleting || isRenaming ? 1 : 1.1 }}
          whileTap={{ scale: isDeleting || isRenaming ? 1 : 0.95 }}
          title="Delete room"
        >
          {isDeleting ? (
            <Loader2 size={16} className="animate-spin text-red-600" />
          ) : (
            <Trash2 size={16} className="text-red-600" />
          )}
        </motion.button>
      </div>
    </div>
  );
};

export default RoomCard;