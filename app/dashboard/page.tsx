'use client'
import React, { useMemo } from 'react'
import RoomCard from './_components/RoomCard';
import { Skeleton } from '@/components/ui/skeleton';
import CreateRoomBtn from './_components/CreateRoomBtn';

const ROOMS_DATA = Array.from({length: 10}, (_, i) => ({
  id: i + 1,
  imageUrl: `/thumbnails/${i + 1}.jpeg`,
  name: `Room ${String.fromCharCode(65 + i)}`,
  date: new Date(),
  creator: 'John Doe',
  org: 'Acme Inc'
}));

const page = () => {
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="w-full flex justify-center">
        <div className="flex flex-wrap justify-start gap-5 w-full">
          {Array(10).fill(0).map((_, i) => (
            <Skeleton key={i} className="w-[300px] h-[200px]" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full flex justify-center">
      <div className="flex flex-wrap justify-start gap-5 w-full">
      <CreateRoomBtn/>

        {ROOMS_DATA.map((room, index) => (
          <RoomCard
            key={room.id}
            imageUrl={room.imageUrl}
            name={room.name}
            date={room.date}
            creator={room.creator}
            org={room.org}
            index={index + 1}
          />
        ))}
      </div>
    </div>
  )
}

export default page