'use client'
import React from 'react'
import { motion } from 'framer-motion'

const AppDemoSection = () => {
  return (
    <div className="flex flex-col gap-8 m-10 pb-10">
      {/* First row: Image on the left (slides in from left), content on the right (slides in from right) */}
      <div className="flex flex-col md:flex-row gap-8 items-center">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="w-full md:w-1/3 bg-gray-200 rounded-lg flex items-center justify-center h-64"
        >
          <span className="text-gray-500">Image Placeholder</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="w-full md:w-1/2"
        >
          <p className="text-lg">
            This is a description of the demo section. You can replace this with any relevant text.
          </p>
        </motion.div>
      </div>

      {/* Second row: Content on the left (slides in from left), image on the right (slides in from right) */}
      <div className="flex flex-col md:flex-row gap-8 items-center justify-end">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="w-full md:w-1/3 order-2 md:order-1"
        >
          <p className="text-lg">
            Another description for the second part of the demo section.
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="w-full md:w-1/2 bg-gray-200 rounded-lg flex items-center justify-center h-64 order-1 md:order-2"
        >
          <span className="text-gray-500">Image Placeholder</span>
        </motion.div>
      </div>
    </div>
  )
}

export default AppDemoSection