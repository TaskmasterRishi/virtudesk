import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Rooms } from '../page';

const RoomCard = ({ 
  imageUrl, 
  title, 
  created_at, 
  author_name, 
  org, 
  index 
}: Pick<Rooms, 'imageUrl' | 'title' | 'created_at' | 'author_name'> & { 
  org: string; 
  index: number; 
}) => {
  return (
    <motion.div 
      className="w-[250px] border rounded-lg overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.3,
      }}
      whileHover={{ 
        scale: 1.03,
        boxShadow: "0 10px 20px rgba(0,0,0,0.1)"
      }}
    >
      <motion.div 
        className="p-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.1 + 0.1 }}
      >
        <div className="relative w-full aspect-square bg-gray-100">
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
          {title}
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
  );
};

export default RoomCard;