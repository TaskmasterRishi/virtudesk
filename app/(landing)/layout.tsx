"use client";
import "../globals.css";
import { ResizableNavbar } from "@/components/ResizableNavbar";
import Footer from "@/components/Footer";
import { useUser } from "@clerk/nextjs";
import Loading from "@/components/Loading";
import { useEffect, useState } from "react";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { isLoaded } = useUser();
  const [showLoading, setShowLoading] = useState(true);

  useEffect(() => {
    if (isLoaded) {
      const timer = setTimeout(() => {
        setShowLoading(false);
      }, 1000); 
      return () => clearTimeout(timer);
    }
  }, [isLoaded]);

  if (!isLoaded || showLoading) return <Loading />;
  return (
    <div>
      {children}
      <ResizableNavbar />
      <Footer />
    </div>
  );
}
