// src/helpers/socketEmit.ts

import { Server } from "socket.io";

let io: Server;

export const initializeSocket = (httpServer: any) => {
  io = new Server(httpServer);
};

export type EventType =
  | "chat:create"
  | "chat:delete"
  | "chat:update"
  | "chat:ack"
  | "ticket:update"
  | "ticket:create"
  | "contact:update"
  | "contact:delete"
  | "notification:new";

interface EmitEventParams {
  tenantId: number | string;
  type: EventType;
  payload: Record<string, any>;
}

const emitEvent = ({ tenantId, type, payload }: EmitEventParams): void => {
  if (!io) {
    console.error("Socket.io não foi inicializado");
    return;
  }

  let eventChannel = `${tenantId}:ticketList`;

  if (type.startsWith("contact:")) {
    eventChannel = `${tenantId}:contactList`;
  }

  io.to(tenantId.toString()).emit(eventChannel, {
    type,
    payload,
  });
};

export default emitEvent;
