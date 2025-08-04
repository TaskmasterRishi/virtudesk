"use client";
import "../globals.css";
import { ResizableNavbar } from "@/components/ResizableNavbar";
import Footer from "@/components/Footer";
import { useUser } from "@clerk/nextjs";
import Loading from "@/components/Loading";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { isLoaded } = useUser();
  if (!isLoaded) return <Loading />;
  return (
    <div>
      {children}
      <ResizableNavbar />
      <Footer />
    </div>
  );
}
