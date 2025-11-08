import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
} from "@/components/ui/sidebar";
import Image from "next/image";
import { NavMain } from "./nav-main";
import OrgMain from "./OrgMain";
import { Separator } from "@/components/ui/separator";
import MemberList from "./MemberList";
import { NavUser } from "./nav-user";

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-accent">
            <Image
              src="/logo.png"
              alt="virtuDesk logo"
              width={40}
              height={40}
              className="rounded-lg"
            />
          </div>
          <div className="grid flex-1 text-left text-base leading-tight">
            <span className="truncate font-medium text-sidebar-foreground">
              Virtudesk
            </span>
            <span className="text-sm text-sidebar-muted-foreground truncate">
              Dashboard
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="space-y-4">
        <SidebarGroup>
          <NavMain />
        </SidebarGroup>
        <Separator className="mx-4 w-auto" />
        <SidebarGroup>
          <OrgMain />
        </SidebarGroup>
        <Separator className="mx-4 w-auto" />
        <SidebarGroup>
          <MemberList />
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser/>
      </SidebarFooter>
    </Sidebar>
  );
}
