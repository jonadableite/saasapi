// src/types/environment.d.ts

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      REDIS_HOST: string;
      REDIS_PORT: string;
      REDIS_PASSWORD: string;
      // ... outros tipos de ambiente
    }
  }
}

export {};
