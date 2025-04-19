// src/types/warmup.ts
export interface MediaContent {
  type: "image" | "video" | "audio" | "sticker";
  url?: string;
  base64?: string;
  mimetype?: string;
  caption?: string;
  fileName?: string;
  preview?: string;
}

export interface WarmupConfig {
  userId: string;
  phoneInstances: Array<{
    instanceId: string;
    phoneNumber: string;
  }>;
  contents: {
    texts: string[];
    images: (string | MediaContent)[];
    audios: (string | MediaContent)[];
    videos: (string | MediaContent)[];
    stickers: (string | MediaContent)[];
    emojis: string[];
  };
  config: {
    textChance: number;
    audioChance: number;
    reactionChance: number;
    stickerChance: number;
    imageChance: number;
    videoChance: number;
    minDelay: number;
    maxDelay: number;
  };
}
