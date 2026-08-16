import { CreatureElement } from '../types';

export type FoodType = 'berry' | 'super' | 'golden';

export interface ServerStats {
  tickRate: number;
  tickIntervalMs?: number;
  activePlayers: number;
  activeBots: number;
  totalCreatures: number;
  totalFood: number;
  step: number;
  uptimeSeconds: number;
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  score: number;
  color: string;
  isBot: boolean;
  kills: number;
  foodEaten: number;
}

export interface WSStateMessage {
  type: 'state';
  worldRadius: number;
  tick: number;
  creatures: any[];
  foods: any[];
  leaderboard: LeaderboardEntry[];
  stats: ServerStats;
}

export interface WSChatMessage {
  type: 'chat';
  chatSender: string;
  chatMessage: string;
  chatColor: string;
  chatTimestamp: string;
}

export interface WSInitMessage {
  type: 'init';
  yourId: string;
  worldRadius: number;
}

type MessageHandler = (msg: any) => void;

export class GameWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private isConnected: boolean = false;
  private playerId: string;
  private handlers: Set<MessageHandler> = new Set();
  private pingInterval: any = null;
  public currentPingMs: number = 0;
  private reconnectTimer: any = null;

  constructor() {
    let pid = sessionStorage.getItem('creatures_player_id');
    if (!pid) {
      pid = `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      sessionStorage.setItem('creatures_player_id', pid);
    }
    this.playerId = pid;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    this.url = `${protocol}//${host}/ws?playerId=${this.playerId}`;
  }

  public connect(playerName: string, playerColor: string, elements: CreatureElement[], presetIndex: number = 0) {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.ws) {
      const oldWs = this.ws;
      this.ws = null;
      oldWs.onopen = null;
      oldWs.onmessage = null;
      oldWs.onclose = null;
      oldWs.onerror = null;
      try {
        oldWs.close();
      } catch (e) {
        // ignore
      }
    }

    try {
      const currentWs = new WebSocket(this.url);
      this.ws = currentWs;

      currentWs.onopen = () => {
        if (this.ws !== currentWs) return;
        this.isConnected = true;
        console.log('[WS] Connected to Go Server');

        // Send join payload
        this.send({
          type: 'join',
          name: playerName,
          color: playerColor,
          elements,
          presetIndex,
        });

        // Start ping ticker
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.ws === currentWs && currentWs.readyState === WebSocket.OPEN) {
            this.send({ type: 'ping', clientTime: Date.now() });
          }
        }, 3000);
      };

      currentWs.onmessage = (event) => {
        if (this.ws !== currentWs) return;
        try {
          const lines = event.data.split('\n');
          for (const line of lines) {
            if (!line) continue;
            const msg = JSON.parse(line);

            if (msg.type === 'pong' && msg.clientTime) {
              this.currentPingMs = Date.now() - msg.clientTime;
            }

            this.handlers.forEach((handler) => handler(msg));
          }
        } catch (e) {
          console.error('[WS] Error parsing message:', e);
        }
      };

      currentWs.onclose = (event) => {
        if (this.ws !== currentWs) return;
        this.isConnected = false;
        if (this.pingInterval) {
          clearInterval(this.pingInterval);
          this.pingInterval = null;
        }
        console.log(`[WS] Connection closed (${event.code}). Reconnecting in 2s...`);
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          if (this.ws === currentWs || !this.ws) {
            this.connect(playerName, playerColor, elements, presetIndex);
          }
        }, 2000);
      };

      currentWs.onerror = () => {
        if (this.ws !== currentWs) return;
        console.log('[WS] Connection error notice');
      };
    } catch (e) {
      console.error('[WS] Connection failed:', e);
    }
  }

  public send(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  public sendInput(targetAngleDeg: number, targetX: number, targetY: number, muscleContract: boolean = false, dash: boolean = false, brake?: boolean) {
    this.send({
      type: 'input',
      targetAngleDeg,
      targetX,
      targetY,
      muscleContract,
      dash,
      brake,
    });
  }

  public sendBrake(brake: boolean) {
    this.send({
      type: 'input',
      brake,
    });
  }

  public sendChatMessage(name: string, color: string, chatMessage: string) {
    this.send({
      type: 'chat',
      name,
      color,
      chatMessage,
    });
  }

  public sendSpawnFood(x: number, y: number, foodType: FoodType = 'berry') {
    this.send({
      type: 'spawn_food',
      foodX: x,
      foodY: y,
      foodType,
    });
  }

  // ================= ADMIN COMMANDS =================
  public sendAdminSetSpeed(speedMs: number) {
    this.send({
      type: 'admin_set_speed',
      speedMs,
    });
  }

  public sendAdminUpdateConfig(config: any) {
    this.send({
      type: 'admin_update_config',
      config,
    });
  }

  public sendAdminDeleteCreature(targetCreatureId: string) {
    this.send({
      type: 'admin_delete_creature',
      targetCreatureId,
    });
  }

  public sendAdminControlInput(
    targetCreatureId: string,
    targetAngleDeg: number,
    targetX: number,
    targetY: number,
    muscleContract: boolean = false,
    dash: boolean = false,
    brake?: boolean
  ) {
    this.send({
      type: 'admin_control_input',
      targetCreatureId,
      targetAngleDeg,
      targetX,
      targetY,
      muscleContract,
      dash,
      brake,
    });
  }

  public sendAdminSpawnCreature(name: string, color: string, elements: CreatureElement[], x: number, y: number) {
    this.send({
      type: 'admin_spawn_creature',
      name,
      color,
      elements,
      targetX: x,
      targetY: y,
    });
  }

  public sendAdminKickUser(targetPlayerId: string, reason: string = 'Кикнут администратором') {
    this.send({
      type: 'admin_kick_user',
      targetPlayerId,
      reason,
    });
  }

  public subscribe(handler: MessageHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  public disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.ws) {
      const oldWs = this.ws;
      this.ws = null;
      oldWs.onopen = null;
      oldWs.onmessage = null;
      oldWs.onclose = null;
      oldWs.onerror = null;
      try {
        oldWs.close();
      } catch (e) {
        // ignore
      }
    }
    this.isConnected = false;
  }

  public getPlayerId(): string {
    return this.playerId;
  }
}

export const gameWs = new GameWebSocket();
