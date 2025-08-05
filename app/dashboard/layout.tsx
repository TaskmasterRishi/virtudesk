"use client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import "../globals.css";
import { AppSidebar } from "./_components/app-sidebar";
import { useUser } from "@clerk/nextjs";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user } = useUser();
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <SidebarTrigger className="hover:bg-accent p-2 rounded-md transition-colors" />
          <h1 className="text-xl font-semibold">
            Welcome, <span className="text-primary">{user?.fullName}</span>
          </h1>
        </div>
        {children}
      </main>
    </SidebarProvider>
  );
}
