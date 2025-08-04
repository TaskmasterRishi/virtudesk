"use client";
import { GridBackground } from "@/components/GridBackground";
import React from "react";
import AppDemoSection from "@/components/AppDemoSection";
import { WorldMapDotted } from "@/components/WorldMapDotted";
import { Testimonials } from "@/components/Testimonials";
const HomePage = () => {
  return (
    <div className="max-w-screen overflow-hidden">
      <GridBackground />
      <WorldMapDotted />
      <AppDemoSection />
      <Testimonials />
    </div>
  );
};

export default HomePage;
