// Sprite utility for managing character sprites
export interface CharacterSprite {
  name: string;
  folderPath: string;
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
    name: 'Pink_Monster',
    folderPath: '/sprites/char1',
    idleFrames: 4,
    walkFrames: 6,
    runFrames: 6,
    animations: {
      idle: 'pink_idle',
      walk: 'pink_walk',
      run: 'pink_run'
    }
  },
  {
    name: 'Owlet_Monster',
    folderPath: '/sprites/char2',
    idleFrames: 4,
    walkFrames: 6,
    runFrames: 6,
    animations: {
      idle: 'owlet_idle',
      walk: 'owlet_walk',
      run: 'owlet_run'
    }
  },
  {
    name: 'Dude_Monster',
    folderPath: '/sprites/char3',
    idleFrames: 4,
    walkFrames: 6,
    runFrames: 6,
    animations: {
      idle: 'dude_idle',
      walk: 'dude_walk',
      run: 'dude_run'
    }
  }
];

// Get sprite paths for a character
export function getSpritePaths(character: CharacterSprite) {
  return {
    idle: `${character.folderPath}/${character.name}_Idle_${character.idleFrames}.png`,
    walk: `${character.folderPath}/${character.name}_Walk_${character.walkFrames}.png`,
    run: `${character.folderPath}/${character.name}_Run_${character.runFrames}.png`
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

// export function getOrSelectCharacter(): CharacterSprite {
//   if (!selectedCharacter) {
//     selectedCharacter = getRandomCharacterSprite();
//   }
//   return selectedCharacter;
// }

// Reset character selection (useful for new sessions)
export function resetCharacterSelection(): void {
  selectedCharacter = null;
}

export function getOrSelectCharacter(): CharacterSprite {
  return AVAILABLE_SPRITES[0];
}