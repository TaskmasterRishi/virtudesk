"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useOrganization, useUser } from '@clerk/nextjs';
import { createRoom } from '@/app/actions/Room';
import { useRoomStore } from '@/app/stores/roomStore';
import { Loader } from 'lucide-react';

const CreateRoomBtn = () => {
  const { organization } = useOrganization();
  const { user } = useUser();
  const { register, handleSubmit, reset } = useForm<{ name: string }>();
  const [isLoading, setIsLoading] = useState(false);
  const { fetchRooms } = useRoomStore();

  const onSubmit = async (data: { name: string }) => {
    if (!organization || !user) return;

    setIsLoading(true);
    try {
      const randomImageNumber = Math.floor(Math.random() * 10) + 1;
      const roomData = {
        org_id: organization.id,
        title: data.name,
        imageUrl: `/thumbnails/${randomImageNumber}.jpeg`,
        author_id: user.id,
        author_name: user.fullName || user.username || 'Anonymous',
      };

      await createRoom(roomData);
      reset();
      await fetchRooms(organization.id); // Zustand will trigger a re-render
    } catch (error) {
      console.error('Failed to create room:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <motion.div 
          className="w-[250px] border-2 rounded-xl flex items-center justify-center cursor-pointer bg-background hover:bg-primary/5 transition-colors"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          whileHover={{ scale: 1.02, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
          whileTap={{ scale: 0.98 }}
        >
          <motion.div 
            className="flex flex-col items-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="relative">
              <div className="absolute inset-0 bg-primary/10 blur-sm"></div>
              <motion.div 
                className="relative text-5xl font-mono text-primary"
                style={{ 
                  textShadow: '2px 2px 0px rgba(0,0,0,0.1)',
                  imageRendering: 'pixelated'
                }}
                whileHover={{
                  scale: [1, 1.2, 1],
                  rotate: [0, 10, -10, 0],
                  transition: { 
                    duration: 0.5,
                    repeat: Infinity,
                    repeatType: "reverse"
                  }
                }}
              >
                +
              </motion.div>
            </div>
            <p className="text-sm font-medium text-primary/80">Create Room</p>
          </motion.div>
        </motion.div>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a New Room</DialogTitle>
          <DialogDescription>Enter a name for your room.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input 
            {...register('name', { required: true })}
            placeholder="Room Name"
          />
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <> <Loader className='animate-spin'/> 'Creating...' </>: 'Create'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateRoomBtn;