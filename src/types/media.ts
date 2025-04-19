// src/types/media.ts
export interface MediaContent {
  type: "image" | "video" | "audio" | "sticker";
  base64?: string;
  fileName?: string;
  mimetype?: string;
  preview?: string;
}
