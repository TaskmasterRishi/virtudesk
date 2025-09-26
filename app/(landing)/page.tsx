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
        {/* Features Section anchored for navbar */}
        <section id="features" className="px-4 sm:px-6 lg:px-8 py-16 scroll-mt-24">
          <div className="max-w-6xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Everything your remote team needs</h2>
            <p className="mt-3 text-muted-foreground">Build your virtual office with rooms, video chat, and collaboration tools.</p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            <div className="rounded-xl border p-6">
              <h3 className="font-semibold text-lg">Virtual Rooms</h3>
              <p className="text-sm text-muted-foreground mt-2">Create rooms for meetings, focus time, or team hangouts with presence.</p>
            </div>
            <div className="rounded-xl border p-6">
              <h3 className="font-semibold text-lg">Realtime Collaboration</h3>
              <p className="text-sm text-muted-foreground mt-2">Move, chat, and collaborate in real-time with a delightful experience.</p>
            </div>
            <div className="rounded-xl border p-6">
              <h3 className="font-semibold text-lg">Organization Management</h3>
              <p className="text-sm text-muted-foreground mt-2">Organize teams, invite members, and manage access with ease.</p>
            </div>
          </div>
        </section>
        {/* Static components render immediately */}
        <AppDemoSection />
        <Testimonials />
      </div>
    </Suspense>
  );
};

export default HomePage;
