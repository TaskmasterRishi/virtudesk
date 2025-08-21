// app/room/[roomId]/page.tsx
import { Suspense } from 'react'
import PhaserMap from '@/game/PhaserMap'
import {LoaderTwo } from '@/components/ui/loader'

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  return (
    <div className="w-full h-screen">
      <Suspense fallback={<div className="w-full h-screen flex items-center justify-center"><LoaderTwo/></div>}>
        <PhaserMap roomId={roomId} />
      </Suspense>
    </div>
  )
}