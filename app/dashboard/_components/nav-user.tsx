"use client";

import { useUser, useAuth } from "@clerk/nextjs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

export function NavUser() {
  const { user } = useUser();
  const { orgRole } = useAuth();

  if (!user) return null;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" className="text-base">
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarImage src={user.imageUrl} alt={user.fullName || "User"} />
            <AvatarFallback className="rounded-lg font-bold bg-primary text-primary-foreground">
              {user?.fullName
                ?.split(" ")
                .map((word) => word[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-base leading-tight">
            <span className="truncate font-medium">{user.fullName}</span>
            <span className="truncate text-sm">{user.primaryEmailAddress?.emailAddress}</span>
          </div>
          {orgRole && (
            <Badge variant="secondary" className="text-sm">
              {orgRole.replace('org:', '')}
            </Badge>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
