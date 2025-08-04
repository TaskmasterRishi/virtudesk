"use client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

import "../globals.css";
import { AppSidebar } from "./_components/app-sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main>
        <SidebarTrigger />
        {children}
      </main>
    </SidebarProvider>
  );
}
