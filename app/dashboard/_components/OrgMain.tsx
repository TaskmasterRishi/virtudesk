import { SidebarGroup, SidebarMenu } from "@/components/ui/sidebar";
import { OrganizationSwitcher, useAuth } from "@clerk/nextjs";
import React, { useEffect } from "react";
import CreateOrgBtn from "./CreateOrgBtn";

const OrgMain = () => {
  const { userId, orgId, orgRole } = useAuth();

  console.log(userId, orgId, orgRole);

  return (
    <SidebarGroup>
      <SidebarMenu>
        <div className="flex flex-col gap-3">
          <CreateOrgBtn />
          <OrganizationSwitcher
            hidePersonal
            appearance={{
              elements: {
                rootBox: {
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  width: "100%",
                },
                organizationSwitcherTrigger: {
                  padding: "12px 16px",
                  width: "100%",
                  borderRadius: "10px",
                  border: "1px solid #E5E7EB",
                  justifyContent: "space-between",
                  backgroundColor: "white",
                  boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                  transition: "all 0.2s ease-in-out",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#374151",
                },
                organizationSwitcherTriggerHover: {
                  backgroundColor: "#F9FAFB",
                  borderColor: "#D1D5DB",
                  boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
                },
                organizationSwitcherTriggerActive: {
                  backgroundColor: "#F3F4F6",
                  borderColor: "#9CA3AF",
                },
              },
            }}
          />
        </div>
      </SidebarMenu>
    </SidebarGroup>
  );
};

export default OrgMain;
