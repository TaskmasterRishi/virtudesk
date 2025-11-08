"use client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import "../globals.css";
import { AppSidebar } from "./_components/app-sidebar";
import { useUser } from "@clerk/nextjs";
import { CharacterSelection } from "./_components/CharacterSelection";
import TasksPanel from "./_components/TasksPanel";
import TaskAssignmentNotification from "@/components/TaskAssignmentNotification";
import { usePathname } from "next/navigation";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user } = useUser();
  const pathname = usePathname();
  const isAnalyticsPage = pathname === '/dashboard/analytics';

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="p-4 w-full dashboard-zoom">
        <div className="flex items-center justify-between mb-4 w-full">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="hover:bg-accent p-2 rounded-md transition-colors" />
            <h1 className="text-xl font-semibold">
              Welcome, <span className="text-primary">{user?.fullName}</span>
            </h1>
          </div>
          {!isAnalyticsPage && <CharacterSelection/>}
        </div>
        <div className="w-full">
          {children}
        </div>
        {!isAnalyticsPage && <TasksPanel />}
        <TaskAssignmentNotification />
      </main>
    </SidebarProvider>
  );
}
