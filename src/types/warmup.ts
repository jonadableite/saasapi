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
    ownerJid?: string; // Adicionando ownerJid para identificar o número da instância
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
    messageLimit?: number;          // Limite de mensagens por instância (padrão baseado no plano)
    groupChance?: number;           // Chance de enviar para grupo (0-1)
    externalNumbersChance?: number; // Chance de usar números externos (0-1)
    groupId?: string;              // ID do grupo para enviar mensagens
    externalNumbers?: string[];    // Lista de números externos customizados
  };
}
