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

    console.log("Socket.io inicializado com sucesso");
    return socketServer;
};

export const getSocketServer = (): Server | null => {
    // Em vez de lançar um erro, retornamos null quando o servidor não está inicializado
    if (!socketServer) {
        console.warn("Socket.io não foi inicializado ainda, retornando null");
        return null;
    }
    return socketServer;
};

export const emitToTenant = (
    tenantId: string | number,
    event: string,
    data: any
): void => {
    const server = getSocketServer();
    if (!server) {
        console.warn(
            `Não foi possível emitir evento ${event} para ${tenantId}: Socket.io não inicializado`
        );
        return;
    }
    server.to(String(tenantId)).emit(event, data);
};

export default {
    initializeSocketServer,
    getSocketServer,
    emitToTenant,
};
