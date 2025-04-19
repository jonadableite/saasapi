// src/types/prismaModels.ts
// Interface para o modelo User
export interface User {
  id: string;
  name: string;
  email: string;
  plan: string;
  trialEndDate: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeSubscriptionStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
}
// Interface para o modelo Instance
export interface Instance {
  id: string;
  instanceName: string;
  connectionStatus: string;
  userId: string;
}
// Interface para o modelo MediaStats
export interface MediaStats {
  id: string;
  instanceName: string;
  date: Date;
  text: number;
  image: number;
  video: number;
  audio: number;
  sticker: number;
  reaction: number;
  totalDaily: number;
  totalAllTime: number;
  createdAt: Date;
  updatedAt: Date;
}
// Interface para o modelo WarmupStat
export interface WarmupStat {
  id: string;
  instanceName: string;
  status: string;
  messagesSent: number;
  messagesReceived: number;
  warmupTime: number;
  lastActive: Date;
  startTime: Date | null;
  pauseTime: Date | null;
  progress: number;
  userId: string;
  mediaStatsId: string | null;
  mediaReceivedId: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    plan: string;
  };
  instance: {
    id: string;
    instanceName: string;
    connectionStatus: string;
  };
  mediaStats: {
    id: string;
    instanceName: string;
    date: Date;
    text: number;
    image: number;
    video: number;
    audio: number;
    sticker: number;
    reaction: number;
    totalDaily: number;
    totalAllTime: number;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  mediaReceived: {
    id: string;
    instanceName: string;
    date: Date;
    text: number;
    image: number;
    video: number;
    audio: number;
    sticker: number;
    reaction: number;
    totalDaily: number;
    totalAllTime: number;
    createdAt: Date;
    updatedAt: Date;
  } | null;
}
