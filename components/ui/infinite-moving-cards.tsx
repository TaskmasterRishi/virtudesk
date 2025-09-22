"use client";

import { cn } from "@/lib/utils";
import React, { useRef, useState, useLayoutEffect } from "react";
import { motion, useMotionValue, useAnimationFrame } from "framer-motion";

export const InfiniteMovingCards = ({
  items,
  direction = "left",
  speed = "fast",
  pauseOnHover = true,
  className,
}: {
  items: {
    quote: string;
    name: string;
    title: string;
  }[];
  direction?: "left" | "right";
  speed?: "fast" | "normal" | "slow";
  pauseOnHover?: boolean;
  className?: string;
}) => {
  // Animation speed in px/sec
  const getSpeed = () => {
    if (speed === "fast") return 100;
    if (speed === "normal") return 50;
    return 20;
  };

  const cards = [...items, ...items];
  const x = useMotionValue(0);
  const [isPaused, setIsPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [singleListWidth, setSingleListWidth] = useState(0);

  // Measure the width of a single set of cards
  useLayoutEffect(() => {
    if (listRef.current) {
      setSingleListWidth(listRef.current.scrollWidth / 2);
    }
  }, [items]);

  useAnimationFrame((t, delta) => {
    if (isPaused || !singleListWidth) return;
    let move = (getSpeed() * delta) / 1000;
    if (direction === "right") move = -move;
    let newX = x.get() - move;

    // Loop seamlessly
    if (direction === "left" && Math.abs(newX) >= singleListWidth) {
      newX += singleListWidth;
    } else if (direction === "right" && newX > 0) {
      newX -= singleListWidth;
    }
    x.set(newX);
  });

  return (
    <div
      ref={containerRef}
      className={cn(
        "scroller relative z-20 w-[90vw] overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_20%,white_80%,transparent)]",
        className,
      )}
    >
      <motion.ul
        ref={listRef}
        className={cn(
          "flex w-max min-w-full shrink-0 flex-nowrap gap-4 py-4"
        )}
        style={{ x }}
        onMouseEnter={() => pauseOnHover && setIsPaused(true)}
        onMouseLeave={() => pauseOnHover && setIsPaused(false)}
      >
        {cards.map((item, idx) => (
          <li
            className="relative w-[350px] max-w-full shrink-0 rounded-lg border border-zinc-200 bg-white px-6 py-4 md:w-[450px] dark:border-zinc-700 dark:bg-zinc-800 shadow-sm hover:shadow-md transition-shadow duration-300"
            key={item.name + idx}
          >
            <div className="flex flex-col gap-4">
              {/* Profile Picture, Name, and Designation */}
              <div className="flex items-center gap-4">
                {/* Placeholder for profile picture (replace with actual image) */}
                <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Photo</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-neutral-800 dark:text-gray-100">
                    {item.name}
                  </span>
                  <span className="text-xs font-normal text-neutral-500 dark:text-gray-400">
                    {item.title}
                  </span>
                </div>
              </div>

              {/* Testimonial Text */}
              <blockquote className="mt-2">
                <span className="text-sm leading-[1.6] font-normal text-neutral-700 dark:text-gray-200">
                  {item.quote}
                </span>
              </blockquote>
            </div>
          </li>
        ))}
      </motion.ul>
    </div>
  );
};