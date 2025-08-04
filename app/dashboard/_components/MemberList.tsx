"use client";
import { useOrganization } from "@clerk/nextjs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";

const MemberList = () => {
  const { organization } = useOrganization();
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    const fetchMembers = async () => {
      if (!organization) return;

      try {
        const memberships = await organization.getMemberships();
        if (memberships) {
          setMembers(memberships.data || []);
        }
      } catch (error) {
        console.error("Error fetching members:", error);
      }
    };

    fetchMembers();
  }, [organization]);

  if (!organization) return null;

  return (
    <div className="space-y-3 h-[350px] overflow-y-auto"> {/* Smaller height */}
      <h3 className="text-sm font-medium">Organization Members</h3> {/* Smaller heading */}
      <div className="space-y-1.5"> {/* Tighter spacing */}
        {members.map((membership) => {
          const publicUserData = membership.publicUserData;
          if (!publicUserData) return null;

          return (
            <div
              key={membership.id}
              className="flex items-center gap-1.5 p-1 rounded-md hover:bg-muted/50 text-xs" // Even smaller padding and text
            >
              <Avatar className="size-5"> {/* Tiny avatar */}
                <AvatarImage src={publicUserData.imageUrl} />
                <AvatarFallback>
                  {publicUserData.identifier?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {publicUserData.firstName} {publicUserData.lastName}
                </p>
                <p className="text-[0.7rem] text-muted-foreground truncate"> {/* Tiny text */}
                  {publicUserData.identifier}
                </p>
              </div>
              <Badge variant="secondary" className="text-[0.7rem] px-1 py-0.5"> {/* Tiny badge */}
                {membership.role.replace('org:','')}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MemberList;