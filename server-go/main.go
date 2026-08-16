package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"creatures-server/game"
	"creatures-server/ws"
)

func main() {
	port := os.Getenv("GO_PORT")
	if port == "" {
		port = "8089"
	}

	fmt.Println("🚀 Starting Go Grid Creatures Modernized Physics Engine...")

	// Initialize dynamic world rules configuration loader (Phase 5)
	game.InitConfigLoader("world_rules.json")
	initialCfg := game.GetGlobalConfig()

	var hubRef *ws.Hub

	// Create Room with bounds from WorldConfig (half radius)
	initialRadius := initialCfg.World.WorldBoundsX / 2.0
	if initialRadius <= 0 {
		initialRadius = 50.0
	}

	room := game.NewRoom(initialRadius, 0, 80, func(msg game.WSOutputMessage, targetPlayerID string) {
		if hubRef != nil {
			hubRef.BroadcastRoomState(msg, targetPlayerID)
		}
	})

	hub := ws.NewHub(room)
	hubRef = hub

	go hub.Run()
	room.StartLoop()

	mux := http.NewServeMux()

	// WebSocket handler
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		ws.ServeWS(hub, w, r)
	})

	// HTTP API endpoints
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "ok",
			"engine": "Go 1.22 Modernized Physics Engine (100 FPS, Huygens-Steiner, CCD, Drag, Hooke Muscles)",
		})
	})

	mux.HandleFunc("/api/rules", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		if r.Method == "POST" {
			var updatedCfg game.WorldConfig
			if err := json.NewDecoder(r.Body).Decode(&updatedCfg); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			if err := game.UpdateConfigInPlace(updatedCfg); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			json.NewEncoder(w).Encode(map[string]interface{}{
				"status": "success",
				"config": game.GetGlobalConfig(),
			})
			return
		}

		json.NewEncoder(w).Encode(game.GetGlobalConfig())
	})

	mux.HandleFunc("/api/presets", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		json.NewEncoder(w).Encode(game.DefaultPresets)
	})

	mux.HandleFunc("/api/stats", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "active",
			"port":   port,
		})
	})

	addr := "0.0.0.0:" + port
	log.Printf("🔥 Go Server running on http://%s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("Go Server error: %v", err)
	}
}
