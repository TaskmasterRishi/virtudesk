"use client";
import { useOrganization } from "@clerk/nextjs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { LoaderFive } from "@/components/ui/loader";

const MemberList = () => {
  const { organization } = useOrganization();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!organization) return;

    const fetchMembers = async () => {
      try {
        setLoading(true);
        const memberships = await organization.getMemberships();
        if (memberships) {
          setMembers(memberships.data || []);
        }
      } catch (error) {
        console.error("Error fetching members:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [organization]);

  if (!organization) return null;

  return (
    <div className="space-y-3 h-[350px] overflow-y-auto">
      <h3 className="text-base font-medium">Organization Members</h3>
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <LoaderFive text="Loading members"/>
        </div>
      ) : (
        <div className="space-y-1.5">
          {members.map((membership) => {
            const publicUserData = membership.publicUserData;
            if (!publicUserData) return null;

            return (
              <div
                key={membership.id}
                className="flex items-center gap-1.5 p-1 rounded-md hover:bg-muted/50 text-sm"
              >
                <Avatar className="size-5">
                  <AvatarImage src={publicUserData.imageUrl} />
                  <AvatarFallback>
                    {publicUserData.identifier?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {publicUserData.firstName} {publicUserData.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {publicUserData.identifier}
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                  {membership.role.replace('org:','')}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MemberList;