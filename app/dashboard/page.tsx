'use client'
import { useUser } from '@clerk/nextjs'
import React, { useEffect } from 'react'

const page = () => {
  const { user } = useUser();

  return (
    <div>
      
    </div>
  )
}

export default page