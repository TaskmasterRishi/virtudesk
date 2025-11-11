'use client'
import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import RoomCard from './_components/RoomCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useOrganization } from '@clerk/nextjs';
import { useRoomStore } from '@/app/stores/roomStore';
import CreateRoomBtn from './_components/CreateRoomBtn';
import { FileText } from 'lucide-react';

export type Rooms = {
  id: string;
  org_id: string;
  title: string;
  imageUrl: string;
  author_id: string;
  author_name: string;
  created_at: string;
}

const page = () => {
  const { organization } = useOrganization();
  const { rooms, isLoading, fetchRooms } = useRoomStore();
  const lastOrgIdRef = useRef<string | null>(null);

  const orgId = organization?.id || null;

  useEffect(() => {
    if (!orgId) return;
    if (lastOrgIdRef.current === orgId) return; // skip duplicate fetches for same org
    lastOrgIdRef.current = orgId;
    fetchRooms(orgId);
  }, [orgId, fetchRooms]);

  if (isLoading && rooms.length === 0) {
    return (
      <div className="w-full flex justify-center">
        <div className="flex flex-wrap justify-start gap-5 w-full">
          {Array(10).fill(0).map((_, i) => (
            <Skeleton key={i} className="w-[300px] h-[200px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* <div className="mb-4 flex justify-end">
        <Button asChild variant="outline" className="flex items-center gap-2">
          <Link href="/dashboard/meetings">
            <FileText className="h-4 w-4" />
            Meeting Summaries
          </Link>
        </Button>
      </div> */}
      <div className="w-full flex justify-center">
        <div className="flex flex-wrap justify-start gap-5 w-full">
          <CreateRoomBtn/>
          {rooms.map((room, index) => (
            <RoomCard
              key={room.id}
              id={room.id}
              imageUrl={room.imageUrl}
              title={room.title}
              created_at={room.created_at}
              author_name={room.author_name || ''}
              org={organization?.name || ''}
              index={index + 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default page;