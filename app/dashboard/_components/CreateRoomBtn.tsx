"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useOrganization } from '@clerk/nextjs';
import { createRoom } from '@/app/actions/Room';

const CreateRoomBtn = () => {
  const { organization } = useOrganization();
  const { register, handleSubmit, reset } = useForm<{ name: string }>();

  const onSubmit = async (formData: { name: string }) => {
    if (!organization) throw new Error('No organization found');

    try {
      const room = await createRoom({
        name: formData.name,
        org_id: organization.id, // Pass the org_id explicitly
      });
      console.log('Room created:', room);
      reset();
    } catch (error) {
      console.error('Failed to create room:', error);
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
          <Button type="submit">Create</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateRoomBtn;