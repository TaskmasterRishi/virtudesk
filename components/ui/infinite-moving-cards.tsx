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
        "scroller relative z-20 max-w-7xl overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_20%,white_80%,transparent)]",
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
            className="relative w-[350px] max-w-full shrink-0 rounded-2xl border border-b-0 border-zinc-200 bg-[linear-gradient(180deg,#fafafa,#f5f5f5)] px-8 py-6 md:w-[450px] dark:border-zinc-700 dark:bg-[linear-gradient(180deg,#27272a,#18181b)]"
            key={item.name + idx}
          >
            <blockquote>
              <div
                aria-hidden="true"
                className="user-select-none pointer-events-none absolute -top-0.5 -left-0.5 -z-1 h-[calc(100%_+_4px)] w-[calc(100%_+_4px)]"
              ></div>
              <span className="relative z-20 text-sm leading-[1.6] font-normal text-neutral-800 dark:text-gray-100">
                {item.quote}
              </span>
              <div className="relative z-20 mt-6 flex flex-row items-center">
                <span className="flex flex-col gap-1">
                  <span className="text-sm leading-[1.6] font-normal text-neutral-500 dark:text-gray-400">
                    {item.name}
                  </span>
                  <span className="text-sm leading-[1.6] font-normal text-neutral-500 dark:text-gray-400">
                    {item.title}
                  </span>
                </span>
              </div>
            </blockquote>
          </li>
        ))}
      </motion.ul>
    </div>
  );
};
