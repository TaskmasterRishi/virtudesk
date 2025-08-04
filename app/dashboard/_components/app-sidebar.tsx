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
            />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium text-sidebar-foreground">
              Virtudesk
            </span>
            <span className="text-xs text-sidebar-muted-foreground truncate">
              Dashboard
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
            <NavMain/>
        </SidebarGroup>
        <SidebarGroup>
            <OrgMain/>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}
