// src/services/socket.service.ts
import { Server } from "socket.io";

let socketServer: Server | null = null;

export const initializeSocketServer = (server: any): Server => {
  socketServer = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Configurar namespaces e eventos do Socket.IO
  socketServer.on("connection", (socket) => {
    console.log(`Cliente conectado: ${socket.id}`);

    // Associar usuário a um canal específico (exemplo: tenantId)
    socket.on("join", (tenantId: string) => {
      socket.join(tenantId);
      console.log(`Cliente ${socket.id} entrou no canal ${tenantId}`);
    });

    socket.on("disconnect", () => {
      console.log(`Cliente desconectado: ${socket.id}`);
    });
  });

  return socketServer;
};

export const getSocketServer = (): Server => {
  if (!socketServer) {
    throw new Error("Socket.io não foi inicializado ainda");
  }
  return socketServer;
};

export const emitToTenant = (
  tenantId: string | number,
  event: string,
  data: any
): void => {
  if (!socketServer) {
    console.error("Socket.io não foi inicializado");
    return;
  }

  socketServer.to(String(tenantId)).emit(event, data);
};

export default {
  initializeSocketServer,
  getSocketServer,
  emitToTenant,
};
