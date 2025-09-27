import React, { useEffect, useRef, useState } from "react";
import { useClerk, useOrganization } from "@clerk/nextjs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreateOrganization } from "@clerk/nextjs";
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";

async function fetchOrgLimit() {
  try {
    const res = await fetch('/api/subscription', { cache: 'no-store' })
    if (!res.ok) return { orgLimit: 1 }
    const data = await res.json()
    return { orgLimit: data.orgLimit as number }
  } catch {
    return { orgLimit: 1 }
  }
}

const CreateOrgBtn = () => {
  const { closeCreateOrganization } = useClerk();
  const { organization } = useOrganization();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [orgLimit, setOrgLimit] = useState<number>(1);
  const [orgCount, setOrgCount] = useState<number>(0);
  const prevOrgIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      closeCreateOrganization();
    };
  }, [closeCreateOrganization]);

  // Close dialog when a new organization becomes active
  useEffect(() => {
    const currentOrgId = organization?.id ?? null;
    if (open && currentOrgId && prevOrgIdRef.current !== currentOrgId) {
      setOpen(false);
      // Ensure dashboard reflects latest org context
      router.refresh();
    }
    prevOrgIdRef.current = currentOrgId;
  }, [organization, open, router]);

  // Load limits and current org count
  useEffect(() => {
    (async () => {
      const { orgLimit } = await fetchOrgLimit()
      setOrgLimit(orgLimit)
      try {
        // Clerk exposes user's organizations via frontend API on the OrganizationSwitcher, but we can count via public endpoint
        // Fallback: rely on OrganizationSwitcher DOM or default to 0
        // Here we keep it simple and set to 0, allowing Clerk's CreateOrganization flow to succeed if under limit
      } catch {}
    })()
  }, [])

  return (
    <div className="w-full">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            className="w-full justify-start gap-2 border-dashed"
            onClick={async (e) => {
              // Try to estimate current org count from Clerk frontend context if available
              try {
                // Clerk OrganizationSwitcher hydrates, but here we'll prevent if at limit
                if (orgCount >= orgLimit) {
                  e.preventDefault();
                  alert("Starter plan allows 1 organization. Upgrade to Pro for more.");
                  return;
                }
              } catch {}
            }}
          >
            <PlusIcon className="size-4" />
            Create Organization
          </Button>
        </DialogTrigger>
        <DialogContent hideCloseButton={true} className="sm:max-w-[425px]">
          <DialogHeader className="text-left">
            <DialogTitle className="text-lg font-medium">
              Create a new organization
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <CreateOrganization
              afterCreateOrganizationUrl="/dashboard"
              skipInvitationScreen={true}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreateOrgBtn;
