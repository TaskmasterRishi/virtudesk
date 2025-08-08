"use client";
import "../globals.css";
import { ResizableNavbar } from "@/components/ResizableNavbar";
import Footer from "@/components/Footer";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div>
      {children}
      <ResizableNavbar />
      <Footer />
    </div>
  );
}