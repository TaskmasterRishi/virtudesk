"use client"
import "../globals.css"
import { ResizableNavbar } from "@/components/ResizableNavbar"
import Footer from "@/components/Footer"

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div>
      <ResizableNavbar />
      {children}
      <Footer />
    </div>
  )
}


