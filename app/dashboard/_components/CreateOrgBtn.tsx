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

const CreateOrgBtn = () => {
  const { closeCreateOrganization } = useClerk();
  const { organization } = useOrganization();
  const router = useRouter();
  const [open, setOpen] = useState(false);
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

  return (
    <div className="w-full">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="w-full justify-start gap-2 border-dashed">
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
