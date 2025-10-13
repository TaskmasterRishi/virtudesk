import { useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { AVAILABLE_SPRITES, getCharacterByName } from "@/game/utils/spriteUtils";
import Image from "next/image";
import { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { getUserCharacter, setUserCharacter } from "@/app/actions/Character";

export const CharacterSelection = () => {
  const { user, isSignedIn } = useUser();
  const [selectedCharacter, setSelectedCharacter] = useState<any | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Fetch character on load
  useEffect(() => {
    const loadCharacter = async () => {
      if (!isSignedIn || !user?.id) return;
      const record = await getUserCharacter(user.id);

      if (record?.character_id) {
        const sprite = getCharacterByName(record.character_id) ?? null;
        setSelectedCharacter(sprite);
      } else {
        setSelectedCharacter(null);
        setIsDialogOpen(true);
      }
    };
    loadCharacter();
  }, [user, isSignedIn]);

  // Handle character selection
  const handleCharacterSelect = async (character) => {
    setSelectedCharacter(character);
    setIsDialogOpen(false);
    if (!isSignedIn || !user?.id) return;

    try {
      await setUserCharacter(user.id, character.name);
    } catch (error) {
      console.error("Error saving character:", error);
    }
  };

  if (!isSignedIn) {
    return (
      <Button 
        variant="outline" 
        onClick={() => setIsDialogOpen(true)}
        className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700"
      >
        Select
      </Button>
    );
  }

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div 
              className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700 cursor-pointer hover:ring-2 hover:ring-primary transition-all flex items-center justify-center bg-muted"
              onClick={() => setIsDialogOpen(true)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              {selectedCharacter ? (
                <Image
                  src={selectedCharacter.image}
                  alt={`${selectedCharacter.name} idle`}
                  fill
                  className="object-cover"
                  unoptimized={true}
                  style={{ imageRendering: 'pixelated' }}
                />
              ) : (
                <span className="text-sm">Pick</span>
              )}
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-base">
            <p className="text-base">{selectedCharacter ? `Change character (${selectedCharacter.name})` : 'Select character'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-center">Select Your Character</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-4 py-4">
            {AVAILABLE_SPRITES.map((character) => (
              <motion.div 
                key={character.name}
                className="flex flex-col items-center gap-2 cursor-pointer"
                onClick={() => handleCharacterSelect(character)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700 hover:ring-2 hover:ring-primary transition-all">
                  <Image
                    src={character.image}
                    alt={`${character.name} idle`}
                    fill
                    className="object-cover"
                    unoptimized={true}
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
                <span className="text-base font-medium">{character.name}</span>
              </motion.div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};