import { GridBackground } from '@/components/GridBackground'
import React from 'react'
import { ResizableNavbar } from "@/components/ResizableNavbar";
import { currentUser } from '@clerk/nextjs/server';

const HomePage = async () => {
  const user = await currentUser();
  // Serialize the user object to a plain object
  const serializedUser = user ? {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    imageUrl: user.imageUrl,
    emailAddresses: user.emailAddresses.map(email => ({
      id: email.id,
      emailAddress: email.emailAddress,
    })),
  } : null;

  return (
    <div className='h-[200vh]'>
      <ResizableNavbar user={serializedUser}/>
      <GridBackground/>
    </div>
  )
}

export default HomePage