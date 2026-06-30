import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  },
  namespace: '/realtime',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    const tenant = (client.handshake.query.tenant as string) || 'demo';
    client.join(this.tenantRoom(tenant));
    this.logger.debug(`Client ${client.id} joined ${tenant}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client ${client.id} disconnected`);
  }

  emitToTenant(tenantCode: string, event: string, payload: unknown) {
    if (!this.server) return;
    this.server.to(this.tenantRoom(tenantCode)).emit(event, payload);
    this.server.to(this.tenantRoom(tenantCode)).emit('sync', payload);
  }

  private tenantRoom(tenantCode: string) {
    return `tenant:${tenantCode}`;
  }
}
