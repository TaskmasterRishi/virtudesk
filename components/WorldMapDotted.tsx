"use client";
import WorldMap from "@/components/ui/world-map";
import { motion } from "motion/react";

export function WorldMapDotted() {
  return (
    <div className=" py-40 dark:bg-black bg-white w-full">
      <div className="max-w-7xl mx-auto text-center">
        <p className="font-bold text-xl md:text-4xl dark:text-white text-black">
          Remote{" "}
          <span className="text-neutral-400">
            {"Connectivity".split("").map((word, idx) => (
              <motion.span
                key={idx}
                className="inline-block"
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: idx * 0.04 }}
              >
                {word}
              </motion.span>
            ))}
          </span>
        </p>
        <p className="text-sm md:text-lg text-neutral-500 max-w-2xl mx-auto py-4">
          Break free from traditional boundaries. Work from anywhere, at the
          comfort of your own studio apartment. Perfect for Nomads and
          Travellers.
        </p>
      </div>
      <WorldMap
        dots={[
          {
            start: {
              lat: 64.2008,
              lng: -149.4937,
            }, // Alaska (Fairbanks)
            end: {
              lat: 34.0522,
              lng: -118.2437,
            }, // Los Angeles
          },
          {
            start: { lat: 64.2008, lng: -149.4937 }, // Alaska (Fairbanks)
            end: { lat: -22.7975, lng: -47.8919 }, // Brazil (Brasília)
          },
          {
            start: { lat: -22.7975, lng: -47.8919 }, // Brazil (Brasília)
            end: { lat: 38.7223, lng: 9.1393 }, // Lisbon
          },
          {
            start: { lat: 40.7128, lng: -74.006 }, // New York
            end: { lat: 45.8566, lng: 0.3522 }, // Paris
          },
          {
            start: { lat: 51.5074, lng: -0.1278 }, // London
            end: { lat: 18.6139, lng: 79.209 }, // New Delhi
          },
          {
            start: { lat: 18.6139, lng: 79.209 }, // New Delhi
            end: { lat: 43.1332, lng: 131.9113 }, // Vladivostok
          },
          {
            start: { lat: 18.6139, lng: 79.209 }, // New Delhi
            end: { lat: -1.2921, lng: 36.8219 }, // Nairobi
          },
          {
            start: { lat: 18.6139, lng: 79.209 }, // New Delhi
            end: { lat: 12.2156, lng: 70.6369 }, // Gujarat, India
          },
        ]}
      />
    </div>
  );
}
