package ws

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"creatures-server/game"
)

type Hub struct {
	mu         sync.RWMutex
	clients    map[string]*Client
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	room       *game.Room
}

func NewHub(room *game.Room) *Hub {
	return &Hub{
		clients:    make(map[string]*Client),
		broadcast:  make(chan []byte, 1024),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		room:       room,
	}
}

func (h *Hub) Run() {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[PANIC RECOVERY] Hub Run panic: %v", r)
		}
	}()

	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.playerID] = client
			h.mu.Unlock()
			log.Printf("[WS INFO] Player connected: %s (Total clients: %d)", client.playerID, len(h.clients))

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.playerID]; ok {
				delete(h.clients, client.playerID)
				client.CloseSend()
				h.room.SetPlayerDisconnected(client.playerID)
				log.Printf("[WS INFO] Player disconnected (preserved state): %s", client.playerID)
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.Lock()
			for id, client := range h.clients {
				select {
				case client.send <- message:
				default:
					client.CloseSend()
					delete(h.clients, id)
				}
			}
			h.mu.Unlock()
		}
	}
}

func (h *Hub) handleMessage(client *Client, msg game.WSInputMessage) {
	switch msg.Type {
	case "join":
		c := h.room.AddPlayer(client.playerID, msg.Name, msg.Color, msg.Elements, msg.PresetIndex, msg.TargetX, msg.TargetY, msg.TargetAngleDeg, msg.FoodEaten, msg.Score)
		cfg := game.GetGlobalConfig()
		initMsg := game.WSOutputMessage{
			Type:        "init",
			YourID:      c.ID,
			WorldRadius: cfg.World.WorldBoundsX / 2.0,
			Config:      &cfg,
		}
		data, _ := json.Marshal(initMsg)
		client.send <- data

	case "restart":
		c := h.room.RestartPlayer(client.playerID)
		cfg := game.GetGlobalConfig()
		initMsg := game.WSOutputMessage{
			Type:        "init",
			YourID:      c.ID,
			WorldRadius: cfg.World.WorldBoundsX / 2.0,
			Config:      &cfg,
		}
		data, _ := json.Marshal(initMsg)
		client.send <- data

	case "input":
		h.room.HandleInput(client.playerID, msg)

	case "admin_update_config":
		if msg.Config != nil {
			if err := game.UpdateConfigInPlace(*msg.Config); err != nil {
				log.Printf("[WS ADMIN] Error updating config: %v", err)
			} else {
				log.Printf("[WS ADMIN] Updated world rules config via WebSocket")
				cfg := game.GetGlobalConfig()
				updateMsg := game.WSOutputMessage{
					Type:   "config_updated",
					Config: &cfg,
				}
				if data, err := json.Marshal(updateMsg); err == nil {
					h.broadcast <- data
				}
			}
		}

	case "spawn_food":
		if msg.FoodX != nil && msg.FoodY != nil {
			fType := msg.FoodType
			if fType == "" {
				fType = game.FoodBerry
			}
			h.room.AddFoodAt(*msg.FoodX, *msg.FoodY, fType)
		}

	case "chat":
		if msg.ChatMessage != "" {
			chatMsg := game.WSOutputMessage{
				Type:          "chat",
				ChatSender:    msg.Name,
				ChatMessage:   msg.ChatMessage,
				ChatColor:     msg.Color,
				ChatTimestamp: time.Now().Format("15:04:05"),
			}
			data, _ := json.Marshal(chatMsg)
			h.broadcast <- data
		}

	case "ping":
		pongMsg := game.WSOutputMessage{
			Type:       "pong",
			ClientTime: msg.ClientTime,
			ServerTime: time.Now().UnixMilli(),
		}
		data, _ := json.Marshal(pongMsg)
		client.send <- data

	case "deposit_bank_food":
		if msg.BankFoodAmount > 0 {
			h.room.DepositBankFood(client.playerID, msg.BankFoodAmount)
		}

	case "spend_bank_food":
		if msg.BankFoodAmount > 0 {
			h.room.SpendBankFood(client.playerID, msg.BankFoodAmount)
		}

	case "edit_creature":
		if msg.TargetCreatureID != "" {
			h.room.UpdateCreature(msg.TargetCreatureID, msg.Name, msg.Color, msg.Elements)
		} else {
			cID := fmt.Sprintf("player-%s", client.playerID)
			h.room.UpdateCreature(cID, msg.Name, msg.Color, msg.Elements)
		}

	case "admin_set_speed":
		if msg.SpeedMs > 0 {
			h.room.SetTickInterval(msg.SpeedMs)
			log.Printf("[WS ADMIN] Tick interval changed to %d ms", msg.SpeedMs)
		}

	case "admin_delete_creature":
		if msg.TargetCreatureID != "" {
			h.room.DeleteCreature(msg.TargetCreatureID)
			log.Printf("[WS ADMIN] Deleted creature: %s", msg.TargetCreatureID)
		}

	case "admin_control_input":
		if msg.TargetCreatureID != "" {
			h.room.HandleAdminControlInput(msg.TargetCreatureID, msg)
		}

	case "admin_spawn_creature":
		spawnX := 0.0
		spawnY := 0.0
		if msg.TargetX != nil {
			spawnX = *msg.TargetX
		}
		if msg.TargetY != nil {
			spawnY = *msg.TargetY
		}
		h.room.SpawnAdminCreature(msg.Name, msg.Color, msg.Elements, spawnX, spawnY)
		log.Printf("[WS ADMIN] Spawned custom creature '%s' at (%.1f, %.1f)", msg.Name, spawnX, spawnY)

	case "admin_kick_user":
		if msg.TargetPlayerID != "" {
			targetPid := msg.TargetPlayerID
			reason := msg.Reason
			if reason == "" {
				reason = "Кикнут администратором"
			}
			h.room.RemovePlayer(targetPid)
			h.mu.Lock()
			if kickedClient, ok := h.clients[targetPid]; ok {
				kickMsg := game.WSOutputMessage{
					Type:         "kicked",
					KickedReason: reason,
				}
				kData, _ := json.Marshal(kickMsg)
				kickedClient.send <- kData
				delete(h.clients, targetPid)
				kickedClient.CloseSend()
				log.Printf("[WS ADMIN] Kicked player: %s (Reason: %s)", targetPid, reason)
			}
			h.mu.Unlock()
		}
	}
}

func (h *Hub) BroadcastRoomState(msg game.WSOutputMessage, targetPlayerID string) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	if targetPlayerID != "" {
		h.mu.RLock()
		if client, ok := h.clients[targetPlayerID]; ok {
			select {
			case client.send <- data:
			default:
			}
		}
		h.mu.RUnlock()
	} else {
		select {
		case h.broadcast <- data:
		default:
		}
	}
}
