"use client";
import { GridBackground } from "@/components/GridBackground";
import React, { Suspense } from "react";
import dynamic from "next/dynamic";
import AppDemoSection from "@/components/AppDemoSection"; // Static import
import { Testimonials } from "@/components/Testimonials";
import Loading from "@/components/Loading";

// Only lazy-load components that are actually dynamic
const WorldMapDotted = dynamic(
  () => import("@/components/WorldMapDotted").then((mod) => mod.WorldMapDotted),
  {
    ssr: false,
    loading: () => (
      <div className="h-[400px] w-full bg-neutral-100 animate-pulse" />
    ), // Minimal fallback
  }
);

const HomePage = () => {
  return (
    <Suspense fallback={<Loading/>}>
      <div className="max-w-screen overflow-hidden">
        <GridBackground />
        {/* Only wrap dynamic components in Suspense */}
        <Suspense fallback={<div>Loading...</div>}>
          <WorldMapDotted />
        </Suspense>
        {/* Static components render immediately */}
        <AppDemoSection />
        <Testimonials />
      </div>
    </Suspense>
  );
};

export default HomePage;
