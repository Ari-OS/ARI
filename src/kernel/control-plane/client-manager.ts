import { randomUUID } from 'crypto';
import type { WebSocket } from 'ws';
import type { ControlPlaneMessage } from './protocol.js';
import { createErrorMessage } from './protocol.js';
import { eventMatches, PROTECTED_EVENTS, ADMIN_ONLY_EVENTS } from './events.js';

/**
 * Client capability levels for authorization
 */
export type ClientCapability =
  | 'read:messages'
  | 'write:messages'
  | 'read:sessions'
  | 'write:sessions'
  | 'read:tools'
  | 'read:channels'
  | 'write:channels'
  | 'read:health'
  | 'admin';

/**
 * Client types with their default capabilities
 */
export const CLIENT_TYPE_CAPABILITIES: Record<string, ClientCapability[]> = {
  dashboard: ['read:messages', 'read:sessions', 'read:tools', 'read:channels', 'read:health'],
  channel: ['read:messages', 'write:messages', 'read:sessions', 'write:sessions', 'read:channels'],
  monitor: ['read:messages', 'read:sessions', 'read:tools', 'read:channels', 'read:health'],
  admin: ['read:messages', 'write:messages', 'read:sessions', 'write:sessions', 'read:tools', 'read:channels', 'write:channels', 'read:health', 'admin'],
};

/**
 * Connected client state
 */
export interface ConnectedClient {
  id: string;
  socket: WebSocket;
  clientType: string;
  capabilities: Set<ClientCapability>;
  authenticated: boolean;
  subscriptions: Set<string>;
  connectedAt: Date;
  lastActivity: Date;
  metadata: Record<string, unknown>;
}

/**
 * Client connection statistics
 */
export interface ClientStats {
  totalClients: number;
  authenticatedClients: number;
  clientsByType: Record<string, number>;
  averageConnectionAge: number;
}

/**
 * ClientManager
 *
 * Manages WebSocket client connections, authentication, and subscriptions.
 * Tracks client lifecycle and handles message routing based on subscriptions.
 */
export class ClientManager {
  private clients: Map<string, ConnectedClient> = new Map();
  private socketToClientId: Map<WebSocket, string> = new Map();

  /**
   * Register a new client connection
   */
  addClient(socket: WebSocket, clientType: string = 'monitor'): ConnectedClient {
    const clientId = randomUUID();
    const now = new Date();

    const client: ConnectedClient = {
      id: clientId,
      socket,
      clientType,
      capabilities: new Set(CLIENT_TYPE_CAPABILITIES[clientType] || CLIENT_TYPE_CAPABILITIES.monitor),
      authenticated: false,
      subscriptions: new Set(),
      connectedAt: now,
      lastActivity: now,
      metadata: {},
    };

    this.clients.set(clientId, client);
    this.socketToClientId.set(socket, clientId);

    return client;
  }

  /**
   * Remove a client connection
   */
  removeClient(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    this.socketToClientId.delete(client.socket);
    this.clients.delete(clientId);

    return true;
  }

  /**
   * Remove a client by socket reference
   */
  removeClientBySocket(socket: WebSocket): ConnectedClient | null {
    const clientId = this.socketToClientId.get(socket);
    if (!clientId) return null;

    const client = this.clients.get(clientId);
    if (client) {
      this.removeClient(clientId);
      return client;
    }

    return null;
  }

  /**
   * Get a client by ID
   */
  getClient(clientId: string): ConnectedClient | null {
    return this.clients.get(clientId) || null;
  }

  /**
   * Get a client by socket reference
   */
  getClientBySocket(socket: WebSocket): ConnectedClient | null {
    const clientId = this.socketToClientId.get(socket);
    return clientId ? this.clients.get(clientId) || null : null;
  }

  /**
   * Authenticate a client and update their capabilities
   */
  authenticateClient(
    clientId: string,
    clientType: string,
    additionalCapabilities?: ClientCapability[]
  ): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    client.authenticated = true;
    client.clientType = clientType;
    client.lastActivity = new Date();

    // Set base capabilities for client type
    const baseCapabilities = CLIENT_TYPE_CAPABILITIES[clientType] || CLIENT_TYPE_CAPABILITIES.monitor;
    client.capabilities = new Set(baseCapabilities);

    // Add any additional capabilities
    if (additionalCapabilities) {
      for (const cap of additionalCapabilities) {
        client.capabilities.add(cap);
      }
    }

    return true;
  }

  /**
   * Add subscriptions for a client
   */
  subscribe(clientId: string, events: string[]): string[] {
    const client = this.clients.get(clientId);
    if (!client) return [];

    const subscribed: string[] = [];

    for (const event of events) {
      // Check if client has permission to subscribe to this event
      if (this.canSubscribe(client, event)) {
        client.subscriptions.add(event);
        subscribed.push(event);
      }
    }

    client.lastActivity = new Date();
    return subscribed;
  }

  /**
   * Remove subscriptions for a client
   */
  unsubscribe(clientId: string, events: string[]): string[] {
    const client = this.clients.get(clientId);
    if (!client) return [];

    const unsubscribed: string[] = [];

    for (const event of events) {
      if (client.subscriptions.has(event)) {
        client.subscriptions.delete(event);
        unsubscribed.push(event);
      }
    }

    client.lastActivity = new Date();
    return unsubscribed;
  }

  /**
   * Check if a client can subscribe to an event
   */
  private canSubscribe(client: ConnectedClient, event: string): boolean {
    // Check protected events
    for (const protectedPattern of PROTECTED_EVENTS) {
      if (eventMatches(protectedPattern, event)) {
        if (!client.authenticated) return false;
      }
    }

    // Check admin-only events
    for (const adminPattern of ADMIN_ONLY_EVENTS) {
      if (eventMatches(adminPattern, event)) {
        if (!client.capabilities.has('admin')) return false;
      }
    }

    return true;
  }

  /**
   * Get all clients subscribed to an event
   */
  getSubscribers(event: string): ConnectedClient[] {
    const subscribers: ConnectedClient[] = [];

    for (const client of this.clients.values()) {
      for (const pattern of client.subscriptions) {
        if (eventMatches(pattern, event)) {
          subscribers.push(client);
          break; // Don't add same client twice
        }
      }
    }

    return subscribers;
  }

  /**
   * Send a message to a specific client
   */
  sendToClient(clientId: string, message: ControlPlaneMessage): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    try {
      if (client.socket.readyState === 1) { // WebSocket.OPEN
        client.socket.send(JSON.stringify(message));
        client.lastActivity = new Date();
        return true;
      }
    } catch {
      // Client disconnected or error
      return false;
    }

    return false;
  }

  /**
   * Broadcast a message to all subscribed clients
   */
  broadcast(event: string, message: ControlPlaneMessage): number {
    const subscribers = this.getSubscribers(event);
    let sent = 0;

    for (const client of subscribers) {
      if (this.sendToClient(client.id, message)) {
        sent++;
      }
    }

    return sent;
  }

  /**
   * Broadcast to all connected clients (regardless of subscription)
   */
  broadcastAll(message: ControlPlaneMessage): number {
    let sent = 0;

    for (const client of this.clients.values()) {
      if (this.sendToClient(client.id, message)) {
        sent++;
      }
    }

    return sent;
  }

  /**
   * Update client activity timestamp
   */
  touch(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastActivity = new Date();
    }
  }

  /**
   * Get clients that have been inactive for longer than timeout
   */
  getInactiveClients(timeoutMs: number): ConnectedClient[] {
    const now = Date.now();
    const inactive: ConnectedClient[] = [];

    for (const client of this.clients.values()) {
      if (now - client.lastActivity.getTime() > timeoutMs) {
        inactive.push(client);
      }
    }

    return inactive;
  }

  /**
   * Get connection statistics
   */
  getStats(): ClientStats {
    const clientsByType: Record<string, number> = {};
    let authenticatedCount = 0;
    let totalConnectionAge = 0;
    const now = Date.now();

    for (const client of this.clients.values()) {
      // Count by type
      clientsByType[client.clientType] = (clientsByType[client.clientType] || 0) + 1;

      // Count authenticated
      if (client.authenticated) authenticatedCount++;

      // Sum connection ages
      totalConnectionAge += now - client.connectedAt.getTime();
    }

    return {
      totalClients: this.clients.size,
      authenticatedClients: authenticatedCount,
      clientsByType,
      averageConnectionAge: this.clients.size > 0 ? totalConnectionAge / this.clients.size : 0,
    };
  }

  /**
   * Get all connected client IDs
   */
  getAllClientIds(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Get total number of connected clients
   */
  get size(): number {
    return this.clients.size;
  }

  /**
   * Check if a client has a specific capability
   */
  hasCapability(clientId: string, capability: ClientCapability): boolean {
    const client = this.clients.get(clientId);
    return client ? client.capabilities.has(capability) : false;
  }

  /**
   * Set client metadata
   */
  setMetadata(clientId: string, key: string, value: unknown): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    client.metadata[key] = value;
    return true;
  }

  /**
   * Get client metadata
   */
  getMetadata(clientId: string, key: string): unknown {
    const client = this.clients.get(clientId);
    return client?.metadata[key];
  }

  /**
   * Clear all clients (for shutdown)
   */
  clear(): void {
    for (const client of this.clients.values()) {
      try {
        // Send close message before disconnecting
        const closeMessage = createErrorMessage('SERVER_SHUTDOWN', 'Server is shutting down');
        client.socket.send(JSON.stringify(closeMessage));
        client.socket.close(1001, 'Server shutdown');
      } catch {
        // Ignore errors during shutdown
      }
    }

    this.clients.clear();
    this.socketToClientId.clear();
  }
}
