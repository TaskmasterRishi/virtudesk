'use client'
import React from 'react'
import { motion } from 'framer-motion'

const AppDemoSection = () => {
  return (
    <div className="flex flex-col gap-12 px-4 sm:px-6 lg:px-8 py-16">
      {/* First row: Image on the left (slides in from left), content on the right (slides in from right) */}
      <div className="flex flex-col md:flex-row gap-8 items-center">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="w-full md:w-1/2"
        >
          <img src="/thumbnails/5.jpeg" alt="Team collaboration" className="rounded-xl w-full h-64 object-contain" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="w-full md:w-1/2"
        >
          <h3 className="text-2xl font-semibold">Build your virtual office</h3>
          <p className="text-muted-foreground mt-2">Create organizations and rooms, invite your team, and work together in real-time with presence, chat, and video.</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>• Create unlimited rooms on Pro</li>
            <li>• Real-time movement and chat</li>
            <li>• Organization-level member management</li>
          </ul>
        </motion.div>
      </div>

      {/* Second row: Content on the left (slides in from left), image on the right (slides in from right) */}
      <div className="flex flex-col md:flex-row gap-8 items-center justify-end">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="w-full md:w-1/2 order-2 md:order-1"
        >
          <h3 className="text-2xl font-semibold">Stay connected, from anywhere</h3>
          <p className="text-muted-foreground mt-2">Jump into a room, collaborate on tasks, and keep your team aligned without calendar overhead.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border p-3">Presence indicators</div>
            <div className="rounded-lg border p-3">Text and video chat</div>
            <div className="rounded-lg border p-3">Customizable avatars</div>
            <div className="rounded-lg border p-3">Org-level controls</div>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="w-full md:w-1/2 order-1 md:order-2"
        >
          <img src="/thumbnails/2.jpeg" alt="Rooms and collaboration" className="rounded-xl w-full h-64 object-contain" />
        </motion.div>
      </div>
    </div>
  )
}

export default AppDemoSection