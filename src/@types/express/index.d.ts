import type { User } from "../types/prismaModels";

declare global {
  namespace Express {
    interface Request {
      user?: User | null;
    }
  }
}
