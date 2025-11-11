"use client";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { CalendarClock , SquareTerminal, BarChart3 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@clerk/nextjs";
import { useMemo } from "react";

const allNavItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: SquareTerminal,
    roles: ["org:admin", "admin", "org:member", "basic_member"],
  },
  {
    title: "Meetings",
    url: "/dashboard/meetings",
    icon: CalendarClock,
    roles: ["org:admin", "admin", "org:member", "basic_member"],
  },
  {
    title: "Analytics",
    url: "/dashboard/analytics",
    icon: BarChart3,
    roles: ["org:admin", "admin"], // Only for managers/admins
  },
];


export function NavMain() {
  const pathname = usePathname();
  const { orgRole } = useAuth();

  const navItems = useMemo(() => {
    // Filter items based on user role
    const filtered = allNavItems.filter(item => {
      // If item has no role restriction, show to everyone
      if (!item.roles || item.roles.length === 0) return true;
      
      // If user has no role, only show items available to basic_member
      if (!orgRole) {
        const shouldShow = item.roles.includes("basic_member");
        return shouldShow;
      }
      
      // Check if user's role is in the allowed roles
      // Handle both "org:admin" and "admin" formats
      const hasAccess = item.roles.some(role => {
        // Direct match
        if (role === orgRole) return true;
        // Match "org:admin" with "admin" and vice versa
        if (role === 'org:admin' && orgRole === 'admin') return true;
        if (role === 'admin' && orgRole === 'org:admin') return true;
        return false;
      });
      return hasAccess;
    });
    
    return filtered;
  }, [orgRole]);

  return (
    <SidebarGroup>
      <SidebarMenu>
        {navItems.map((item, index) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <SidebarMenuItem className={pathname === item.url ? 'bg-primary/5 rounded-md' : ''}>
              <SidebarMenuButton
                tooltip={item.title}
                asChild
                className={cn(
                  "hover:cursor-pointer text-base w-full",
                  pathname === item.url ? 'text-primary bg-primary/10' : 'text-muted-foreground'
                )}
              >
                <Link href={item.url} className="flex items-center gap-2">
                  {item.icon && <item.icon />}
                  <span className="text-base">{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </motion.div>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
