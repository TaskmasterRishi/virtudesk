// Sprite utility for managing character sprites
export interface CharacterSprite {
  name: string;
  folderPath: string;
  image: string;
  idleFrames: number;
  walkFrames: number;
  runFrames: number;
  animations: {
    idle: string;
    walk: string;
    run: string;
  };
}

// Available character sprites
export const AVAILABLE_SPRITES: CharacterSprite[] = [
  {
    name: 'Office man',
    folderPath: '/sprites/person1',  // Back to absolute path
    image: '/sprites/person1/person1.png',
    idleFrames: 2,
    walkFrames: 9,
    runFrames: 8,
    animations: {
      idle: 'idle',
      walk: 'walk',
      run: 'run'
    }
  },
  {
    name: 'Office woman',
    folderPath: '/sprites/girl1',  // Back to absolute path
    image: '/sprites/girl1/girl1.png',
    idleFrames: 2,
    walkFrames: 9,
    runFrames: 8,
    animations: {
      idle: 'idle',
      walk: 'walk',
      run: 'run'
    }
  },
  
];

// Get sprite sheet paths for a character. Some sprite packs (like the office worker)
// use generic filenames such as "idle.png", while the others include the character
// name in the filename. Normalize here so the rest of the game can stay agnostic.
export function getSpritePaths(character: CharacterSprite) {
  // Check if animations use generic names (no prefix) - indicates generic filenames
  const usesGenericFilenames = 
    character.animations.idle === 'idle' && 
    character.animations.walk === 'walk' && 
    character.animations.run === 'run';

  if (usesGenericFilenames) {
    return {
      idle: `${character.folderPath}/idle.png`,
      walk: `${character.folderPath}/walk.png`,
      run: `${character.folderPath}/run.png`,
    };
  }

  // Default pattern: use character name in filename
  const sanitizedName = character.name.replace(/\s+/g, "_");
  return {
    idle: `${character.folderPath}/${sanitizedName}_Idle_${character.idleFrames}.png`,
    walk: `${character.folderPath}/${sanitizedName}_Walk_${character.walkFrames}.png`,
    run: `${character.folderPath}/${sanitizedName}_Run_${character.runFrames}.png`,
  };
}

// Randomly select a character sprite
export function getRandomCharacterSprite(): CharacterSprite {
  const randomIndex = Math.floor(Math.random() * AVAILABLE_SPRITES.length);
  return AVAILABLE_SPRITES[randomIndex];
}

// Get a specific character by name
export function getCharacterByName(name: string): CharacterSprite | undefined {
  return AVAILABLE_SPRITES.find(sprite => sprite.name === name);
}

// Store selected character for consistency across game sessions
let selectedCharacter: CharacterSprite | null = null;

// Reset character selection (useful for new sessions)
export function resetCharacterSelection(): void {
  selectedCharacter = null;
}

export function getOrSelectCharacter(): CharacterSprite {
  return AVAILABLE_SPRITES[0];
}