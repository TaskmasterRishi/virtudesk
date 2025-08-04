import React, { useEffect } from "react";
import { useClerk } from "@clerk/nextjs";
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

const CreateOrgBtn = () => {
  const { closeCreateOrganization } = useClerk();

  useEffect(() => {
    return () => {
      closeCreateOrganization();
    };
  }, [closeCreateOrganization]);

  return (
    <div className="w-full">
      <Dialog>
        <DialogTrigger asChild>
          <Button 
            className="w-full justify-start gap-2 border-dashed"
          >
            <PlusIcon className="size-4" />
            Create Organization
          </Button>
        </DialogTrigger>
        <DialogContent 
          hideCloseButton={true}
          className="sm:max-w-[425px]"
        >
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
