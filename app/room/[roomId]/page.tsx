// app/room/[roomId]/page.tsx
import { Suspense } from 'react'
import PhaserMap from '@/game/PhaserMap'
import {LoaderTwo } from '@/components/ui/loader'

export default function RoomPage() {
  return (
    <div className="w-full h-screen">
      <Suspense fallback={<div className="w-full h-screen flex items-center justify-center"><LoaderTwo/></div>}>
        <PhaserMap />
      </Suspense>
    </div>
  )
}