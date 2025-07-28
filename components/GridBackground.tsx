'use client';

import { cn } from "@/lib/utils";
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Monitor,
  Headphones,
  Video,
  MessageSquare,
  Users,
  Mic,
  Phone,
  Mail,
  Calendar,
  Settings,
  Bookmark,
  Camera,
  Cloud,
  Download,
  Edit,
} from "lucide-react";

export function GridBackground() {
  const [isClient, setIsClient] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768); // Adjust the breakpoint as needed
    };
    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Define icons for mobile and desktop views
  const icons = isMobile
    ? [
        { icon: <Monitor />, delay: 0.1 },
        { icon: <Headphones />, delay: 0.5 },
        { icon: <Video />, delay: 0.9 },
        { icon: <MessageSquare />, delay: 1.3 },
        { icon: <Users />, delay: 1.7 },
        { icon: <Mic />, delay: 2.1 },
        { icon: <Phone />, delay: 2.5 },
        { icon: <Mail />, delay: 2.9 },
        { icon: <Calendar />, delay: 3.3 },
      ]
    : [
        { icon: <Monitor />, delay: 0.1 },
        { icon: <Headphones />, delay: 0.5 },
        { icon: <Video />, delay: 0.9 },
        { icon: <MessageSquare />, delay: 1.3 },
        { icon: <Users />, delay: 1.7 },
        { icon: <Mic />, delay: 2.1 },
        { icon: <Phone />, delay: 2.5 },
        { icon: <Mail />, delay: 2.9 },
        { icon: <Calendar />, delay: 3.3 },
        { icon: <Settings />, delay: 3.7 },
        { icon: <Bookmark />, delay: 4.1 },
        { icon: <Camera />, delay: 4.5 },
        { icon: <Cloud />, delay: 4.9 },
        { icon: <Download />, delay: 5.3 },
        { icon: <Edit />, delay: 5.7 },
      ];

  const [positions, setPositions] = useState<
    { left: string; top: string; size: number; rotate: number }[]
  >([]);

  useEffect(() => {
    if (isClient) {
      // Define regions based on viewport size
      const regions = isMobile
        ? [
            { left: [5, 30], top: [25, 35] },    // Top-left (adjusted for mobile)
            { left: [70, 95], top: [25, 35] },   // Top-right (adjusted for mobile)
            { left: [5, 30], top: [65, 95] },    // Bottom-left (adjusted for mobile)
            { left: [70, 95], top: [65, 95] },   // Bottom-right (adjusted for mobile)
          ]
        : [
            { left: [5, 35], top: [25, 35] },    // Top-left (PC)
            { left: [65, 95], top: [25, 35] },   // Top-right (PC)
            { left: [5, 35], top: [65, 95] },    // Bottom-left (PC)
            { left: [65, 95], top: [65, 95] },   // Bottom-right (PC)
          ];

      setPositions(
        icons.map((_, index) => {
          const region = regions[index % regions.length];
          const left = `${Math.random() * (region.left[1] - region.left[0]) + region.left[0]}%`;
          const top = `${Math.random() * (region.top[1] - region.top[0]) + region.top[0]}%`;
          return {
            left,
            top,
            size: Math.floor(Math.random() * 28) + 4,
            rotate: Math.floor(Math.random() * 60) - 30,
            width: Math.floor(Math.random() * 20) + 10,
            height: Math.floor(Math.random() * 20) + 10,
          };
        })
      );
    }
  }, [isClient, isMobile, icons.length]);

  return (
    <div className="relative flex h-[50rem] w-full items-center justify-center bg-white dark:bg-black">
      <div
        className={cn(
          "absolute inset-0",
          "[background-size:40px_40px]",
          "[background-image:linear-gradient(to_right,#e4e4e7_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e7_1px,transparent_1px)]",
          "dark:[background-image:linear-gradient(to_right,#262626_1px,transparent_1px),linear-gradient(to_bottom,#262626_1px,transparent_1px)]"
        )}
      />
      {/* Radial gradient for the container to give a faded look */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)] dark:bg-black"></div>
      {/* Floating icons (only rendered on the client) */}
      {isClient &&
        positions.length > 0 &&
        icons.map(({ icon, delay }, index) =>
          positions[index] ? (
            <motion.div
              key={index}
              initial={{ y: 0, opacity: 0 }}
              animate={{
                y: [0, -20, 0],
                opacity: [0, 1, 0],
                rotate: positions[index].rotate,
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                repeatType: "reverse",
                delay,
              }}
              className="absolute text-gray-500 dark:text-gray-400"
              style={{
                left: positions[index].left,
                top: positions[index].top,
                fontSize: `${positions[index].size}px`,
                transform: `rotate(${positions[index].rotate}deg)`,
              }}
            >
              {icon}
            </motion.div>
          ) : null
        )}
      <div className="relative z-20 text-center">
        <p className="bg-gradient-to-b from-[#affcfc] via-[#5c03fb] to-[#7d1ef6] bg-clip-text py-8 text-4xl font-bold text-transparent sm:text-7xl">
          VirtuDesk
        </p>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          Work Together, From Anywhere
        </p>
        <p className="mt-4 mx-auto text-gray-500 dark:text-gray-400">
          Virtual Office is a futuristic platform that brings remote teams
          together through interactive 2D avatars and spatial audio.
        </p>
        <p className="max-w-xl mx-auto text-gray-500 dark:text-gray-400">
          Collaborate, communicate, and connect — just like in a real office,
          but from anywhere.
        </p>
      </div>
    </div>
  );
}
