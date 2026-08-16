package game

import (
	"fmt"
	"math"
	"math/rand"
	"sort"
	"sync"
	"time"
)

type EventCallback func(msg WSOutputMessage, targetPlayerID string)

type Room struct {
	mu             sync.RWMutex
	worldRadius    float64
	step           uint64
	creatures      map[string]*Creature
	foods          map[string]*Food
	spatialGrid    *SpatialGrid
	botController  *BotController
	broadcastCb    EventCallback
	startTime      time.Time
	lastTickTime   time.Time
	minBots        int
	maxFoods       int
	tickIntervalMs time.Duration
	rnd            *rand.Rand
}

func NewRoom(worldRadius float64, minBots int, maxFoods int, cb EventCallback) *Room {
	cfg := GetGlobalConfig()
	fps := cfg.World.TickRate
	if fps < 10 {
		fps = 100
	}
	interval := time.Duration(1000/fps) * time.Millisecond

	if worldRadius <= 0 {
		worldRadius = cfg.World.WorldBoundsX / 2.0
	}

	r := &Room{
		worldRadius:    worldRadius,
		step:           0,
		creatures:      make(map[string]*Creature),
		foods:          make(map[string]*Food),
		spatialGrid:    NewSpatialGrid(10.0),
		botController:  NewBotController(),
		broadcastCb:    cb,
		startTime:      time.Now(),
		lastTickTime:   time.Now(),
		minBots:        minBots,
		maxFoods:       maxFoods,
		tickIntervalMs: interval, // 10ms for 100 FPS
		rnd:            rand.New(rand.NewSource(time.Now().UnixNano())),
	}

	// Register config change listener to update physics parameters dynamically
	RegisterConfigChangeListener(func(newCfg WorldConfig) {
		r.mu.Lock()
		if newCfg.World.WorldBoundsX > 0 {
			r.worldRadius = newCfg.World.WorldBoundsX / 2.0
		}
		if newCfg.World.TickRate > 0 {
			r.tickIntervalMs = time.Duration(1000/newCfg.World.TickRate) * time.Millisecond
		}
		r.mu.Unlock()

		if r.broadcastCb != nil {
			r.broadcastCb(WSOutputMessage{
				Type:   "config",
				Config: &newCfg,
			}, "")
		}
	})

	r.initWorld()
	return r
}

func (r *Room) SetTickInterval(ms int) {
	if ms < 10 {
		ms = 10
	}
	if ms > 100 {
		ms = 100
	}
	r.mu.Lock()
	r.tickIntervalMs = time.Duration(ms) * time.Millisecond
	r.mu.Unlock()
}

func (r *Room) initWorld() {
	for i := 0; i < r.maxFoods; i++ {
		r.spawnRandomFood()
	}

	bots := r.botController.SpawnInitialBots(r.minBots, r.worldRadius)
	for _, bot := range bots {
		b := bot
		r.creatures[b.ID] = &b
	}
}

func (r *Room) spawnRandomFood() {
	id := fmt.Sprintf("food-%d-%d", time.Now().UnixNano(), r.rnd.Intn(10000))
	x := math.Round((r.rnd.Float64() - 0.5) * (r.worldRadius * 1.8))
	y := math.Round((r.rnd.Float64() - 0.5) * (r.worldRadius * 1.8))

	cfg := GetGlobalConfig()
	foodType := FoodBerry
	val := cfg.Economy.FoodBerryValue
	if val <= 0 {
		val = 1
	}
	typeRoll := r.rnd.Float64()
	if typeRoll > 0.85 {
		foodType = FoodGolden
		val = cfg.Economy.FoodGoldenValue
		if val <= 0 {
			val = 5
		}
	} else if typeRoll > 0.65 {
		foodType = FoodSuper
		val = int(math.Max(2, float64(val)*2))
	}

	f := Food{
		ID:        id,
		X:         x,
		Y:         y,
		Value:     val,
		Type:      foodType,
		SpawnTime: time.Now().UnixMilli(),
	}
	r.foods[id] = &f
}

func (r *Room) AddPlayer(playerID, name, color string, elements []CreatureElement, presetIndex int, targetX *float64, targetY *float64, targetAngleDeg *float64, foodEatenParam *int, scoreParam *int) *Creature {
	r.mu.Lock()
	defer r.mu.Unlock()

	cID := fmt.Sprintf("player-%s", playerID)

	if existing, exists := r.creatures[cID]; exists && existing != nil {
		// Player reconnected! Wake them up and preserve their live state
		existing.IsSleeping = false
		existing.LastActive = time.Now()
		if name != "" {
			existing.Name = name
		}
		if color != "" {
			existing.Color = color
		}
		if len(elements) > 0 && len(existing.Elements) == 0 {
			existing.Elements = elements
			existing.Forces = CalculatePhysicsForces(elements, existing.MuscleStep)
		}
		return existing
	}

	if len(elements) == 0 {
		elements = StarterPreset()
	}

	forces := CalculatePhysicsForces(elements, 0)
	angle := DetermineCreatureHeadAngle(elements)
	if targetAngleDeg != nil {
		angle = *targetAngleDeg
	}

	baseX, baseY := GetBaseSpawnPoint(r.worldRadius)
	spawnX := baseX + (r.rnd.Float64()-0.5)*4.0
	spawnY := baseY + (r.rnd.Float64()-0.5)*4.0
	if targetX != nil && targetY != nil {
		spawnX = *targetX
		spawnY = *targetY
	}

	if name == "" {
		name = fmt.Sprintf("Чудик-%s", playerID[:minInt(4, len(playerID))])
	}
	if color == "" {
		color = fmt.Sprintf("hsl(%d, 85%%, 55%%)", r.rnd.Intn(360))
	}

	inBase := IsInsideBase(spawnX, spawnY, r.worldRadius)

	bankFood := 0
	foodEaten := 0
	kills := 0
	score := 0
	energy := 100.0
	maxEnergy := 100.0

	if foodEatenParam != nil && *foodEatenParam >= 0 {
		foodEaten = *foodEatenParam
		bankFood = *foodEatenParam
	}
	if scoreParam != nil && *scoreParam >= 0 {
		score = *scoreParam
	}

	creature := &Creature{
		ID:             cID,
		PlayerID:       playerID,
		Name:           name,
		Color:          color,
		IsBot:          false,
		X:              spawnX,
		Y:              spawnY,
		AngleDeg:       angle,
		TargetAngleDeg: angle,
		TargetX:        spawnX,
		TargetY:        spawnY,
		VelX:           0,
		VelY:           0,
		AngularVel:     0,
		IsSleeping:     false,
		Energy:         energy,
		MaxEnergy:      maxEnergy,
		FoodEaten:      foodEaten,
		BankFood:       bankFood,
		InBase:         inBase,
		Score:          score,
		StepsCount:     0,
		MuscleStep:     0,
		State:          "idle",
		IsDashing:      false,
		Elements:       elements,
		Forces:         forces,
		PrevX:          spawnX,
		PrevY:          spawnY,
		PrevAngleDeg:   angle,
		Kills:          kills,
		LastActive:     time.Now(),
	}

	r.creatures[cID] = creature
	return creature
}

func (r *Room) SetPlayerDisconnected(playerID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	cID := fmt.Sprintf("player-%s", playerID)
	if c, exists := r.creatures[cID]; exists && c != nil {
		c.IsSleeping = true
		c.LastActive = time.Now()
	}
}

func (r *Room) DepositBankFood(playerID string, amount int) int {
	if amount <= 0 {
		return 0
	}
	r.mu.Lock()
	defer r.mu.Unlock()

	// Try player-%s or direct ID
	cID := fmt.Sprintf("player-%s", playerID)
	c, exists := r.creatures[cID]
	if !exists || c == nil {
		c, exists = r.creatures[playerID]
	}
	if exists && c != nil {
		c.FoodEaten += amount
		c.BankFood = c.FoodEaten
		c.Score += amount
		return c.FoodEaten
	}
	return 0
}

func (r *Room) SpendBankFood(playerID string, amount int) bool {
	if amount <= 0 {
		return true
	}
	r.mu.Lock()
	defer r.mu.Unlock()

	cID := fmt.Sprintf("player-%s", playerID)
	c, exists := r.creatures[cID]
	if !exists || c == nil {
		c, exists = r.creatures[playerID]
	}
	if exists && c != nil {
		if c.FoodEaten >= amount {
			c.FoodEaten -= amount
			c.BankFood = c.FoodEaten
			return true
		}
	}
	return false
}

func (r *Room) UpdateCreature(creatureID, name, color string, elements []CreatureElement) *Creature {
	r.mu.Lock()
	defer r.mu.Unlock()

	c, exists := r.creatures[creatureID]
	if !exists || c == nil {
		return nil
	}

	if name != "" {
		c.Name = name
	}
	if color != "" {
		c.Color = color
	}
	if len(elements) > 0 {
		c.Elements = elements
		c.Forces = CalculatePhysicsForces(elements, c.MuscleStep)
		c.AngleDeg = DetermineCreatureHeadAngle(elements)
		c.TargetAngleDeg = c.AngleDeg
	}
	return c
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func (r *Room) RemovePlayer(playerID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	cID := fmt.Sprintf("player-%s", playerID)
	delete(r.creatures, cID)
}

func (r *Room) RestartPlayer(playerID string) *Creature {
	r.mu.Lock()
	defer r.mu.Unlock()

	cID := fmt.Sprintf("player-%s", playerID)
	baseX, baseY := GetBaseSpawnPoint(r.worldRadius)
	spawnX := baseX + (r.rnd.Float64()-0.5)*2.0
	spawnY := baseY + (r.rnd.Float64()-0.5)*2.0

	starter := StarterPreset()
	forces := CalculatePhysicsForces(starter, 0)
	angle := DetermineCreatureHeadAngle(starter)

	creature, exists := r.creatures[cID]
	if !exists || creature == nil {
		creature = &Creature{
			ID:             cID,
			PlayerID:       playerID,
			Name:           fmt.Sprintf("Чудик-%s", playerID[:minInt(4, len(playerID))]),
			Color:          fmt.Sprintf("hsl(%d, 85%%, 55%%)", r.rnd.Intn(360)),
			IsBot:          false,
			MaxEnergy:      100.0,
		}
		r.creatures[cID] = creature
	}

	creature.Elements = starter
	creature.Forces = forces
	creature.X = spawnX
	creature.Y = spawnY
	creature.TargetX = spawnX
	creature.TargetY = spawnY
	creature.PrevX = spawnX
	creature.PrevY = spawnY
	creature.AngleDeg = angle
	creature.TargetAngleDeg = angle
	creature.PrevAngleDeg = angle
	creature.VelX = 0
	creature.VelY = 0
	creature.AngularVel = 0
	creature.IsSleeping = false
	creature.FoodEaten = 0
	creature.BankFood = 0
	creature.Score = 0
	creature.Kills = 0
	creature.Energy = 100.0
	creature.InBase = true
	creature.StepsCount = 0
	creature.MuscleStep = 0
	creature.State = "idle"
	creature.IsDashing = false
	creature.LastActive = time.Now()

	return creature
}

func (r *Room) HandleInput(playerID string, msg WSInputMessage) {
	r.mu.Lock()
	defer r.mu.Unlock()

	cID := fmt.Sprintf("player-%s", playerID)
	c, exists := r.creatures[cID]
	if !exists {
		return
	}

	// Wake up creature on input
	c.IsSleeping = false
	c.LastActive = time.Now()

	if msg.TargetAngleDeg != nil {
		c.TargetAngleDeg = *msg.TargetAngleDeg
	}
	if msg.TargetX != nil && msg.TargetY != nil {
		c.TargetX = *msg.TargetX
		c.TargetY = *msg.TargetY
	}

	if msg.MuscleContract {
		c.MuscleStep++
	}

	if msg.Brake != nil {
		c.IsBraking = *msg.Brake
	} else if msg.ToggleBrake {
		c.IsBraking = !c.IsBraking
	}

	c.IsDashing = msg.Dash && c.FoodEaten > 0 && !c.IsBraking
	if !c.IsDashing && c.State == "dashing" {
		c.State = "moving"
	}
}

func (r *Room) HandleAdminControlInput(targetCreatureID string, msg WSInputMessage) {
	r.mu.Lock()
	defer r.mu.Unlock()

	c, exists := r.creatures[targetCreatureID]
	if !exists {
		return
	}

	c.IsSleeping = false
	c.LastActive = time.Now()
	c.AdminControlledUntil = time.Now().Add(5 * time.Second)

	if msg.TargetAngleDeg != nil {
		c.TargetAngleDeg = *msg.TargetAngleDeg
	}
	if msg.TargetX != nil && msg.TargetY != nil {
		c.TargetX = *msg.TargetX
		c.TargetY = *msg.TargetY
	}

	if msg.MuscleContract {
		c.MuscleStep++
	}

	if msg.Brake != nil {
		c.IsBraking = *msg.Brake
	} else if msg.ToggleBrake {
		c.IsBraking = !c.IsBraking
	}

	c.IsDashing = msg.Dash && c.FoodEaten > 0 && !c.IsBraking
	if !c.IsDashing && c.State == "dashing" {
		c.State = "moving"
	}
}

func (r *Room) DeleteCreature(creatureID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.creatures, creatureID)
}

func (r *Room) SpawnAdminCreature(name, color string, elements []CreatureElement, x, y float64) *Creature {
	r.mu.Lock()
	defer r.mu.Unlock()

	cID := fmt.Sprintf("npc-admin-%d-%d", time.Now().UnixNano(), r.rnd.Intn(10000))
	if name == "" {
		name = "Админ-Чудик"
	}
	if color == "" {
		color = "#ef4444"
	}

	forces := CalculatePhysicsForces(elements, 0)
	angle := DetermineCreatureHeadAngle(elements)

	creature := Creature{
		ID:             cID,
		PlayerID:       "admin",
		Name:           name,
		Color:          color,
		IsBot:          false,
		X:              x,
		Y:              y,
		AngleDeg:       angle,
		TargetAngleDeg: angle,
		TargetX:        x,
		TargetY:        y,
		VelX:           0,
		VelY:           0,
		AngularVel:     0,
		IsSleeping:     false,
		Energy:         200,
		MaxEnergy:      200,
		FoodEaten:      50,
		Score:          150,
		StepsCount:     0,
		MuscleStep:     0,
		State:          "idle",
		IsDashing:      false,
		Elements:       elements,
		Forces:         forces,
		PrevX:          x,
		PrevY:          y,
		PrevAngleDeg:   angle,
		Kills:          0,
		LastActive:     time.Now(),
	}

	r.creatures[cID] = &creature
	return &creature
}

func (r *Room) AddFoodAt(x, y float64, foodType FoodType) {
	r.mu.Lock()
	defer r.mu.Unlock()

	cfg := GetGlobalConfig()
	val := cfg.Economy.FoodBerryValue
	if val <= 0 {
		val = 1
	}
	if foodType == FoodGolden {
		val = cfg.Economy.FoodGoldenValue
		if val <= 0 {
			val = 5
		}
	} else if foodType == FoodSuper {
		val = int(math.Max(2, float64(val)*2))
	}

	id := fmt.Sprintf("food-custom-%d-%d", time.Now().UnixNano(), r.rnd.Intn(1000))
	r.foods[id] = &Food{
		ID:        id,
		X:         x,
		Y:         y,
		Value:     val,
		Type:      foodType,
		SpawnTime: time.Now().UnixMilli(),
	}
}

func (r *Room) StartLoop() {
	go func() {
		defer func() {
			if rec := recover(); rec != nil {
				fmt.Printf("[PANIC RECOVERY] Room Tick loop recovered: %v\n", rec)
			}
		}()
		for {
			r.mu.RLock()
			interval := r.tickIntervalMs
			r.mu.RUnlock()

			time.Sleep(interval)
			r.safeTick()
		}
	}()
}

func (r *Room) safeTick() {
	defer func() {
		if rec := recover(); rec != nil {
			fmt.Printf("[PANIC RECOVERY] Room Tick error: %v\n", rec)
		}
	}()
	r.Tick()
}

func (r *Room) Tick() {
	r.mu.Lock()

	r.step++
	now := time.Now()
	cfg := GetGlobalConfig()
	dt := float64(r.tickIntervalMs.Milliseconds()) / 1000.0
	if dt <= 0 {
		dt = 0.01 // 100 FPS = 10ms
	}

	// 1. Maintain minimum bots count
	currentBots := 0
	for _, c := range r.creatures {
		if c.IsBot {
			currentBots++
		}
	}
	if currentBots < r.minBots {
		newBots := r.botController.SpawnInitialBots(r.minBots-currentBots, r.worldRadius)
		for _, bot := range newBots {
			b := bot
			r.creatures[b.ID] = &b
		}
	}

	// 2. Maintain food density
	if len(r.foods) < r.maxFoods {
		r.spawnRandomFood()
	}

	// 3. Build spatial grids (food + creatures)
	r.spatialGrid.Clear()
	for _, f := range r.foods {
		r.spatialGrid.Insert(f.ID, f.X, f.Y)
	}

	creatureGrid := NewSpatialGrid(10.0)
	creatureMap := make(map[string]int)
	creatureSlice := make([]Creature, 0, len(r.creatures))
	idx := 0
	for _, c := range r.creatures {
		creatureSlice = append(creatureSlice, *c)
		creatureMap[c.ID] = idx
		creatureGrid.Insert(c.ID, c.X, c.Y)
		idx++
	}

	// 4. Process each creature
	for _, c := range r.creatures {
		c.PrevX = c.X
		c.PrevY = c.Y
		c.PrevAngleDeg = c.AngleDeg

		// Bot AI — scan nearby entities
		if c.IsBot {
			nearbyFoodIDs := r.spatialGrid.GetNearby(c.X, c.Y, 25.0)
			botFoods := make([]Food, 0, len(nearbyFoodIDs))
			for _, fid := range nearbyFoodIDs {
				if f, ok := r.foods[fid]; ok {
					botFoods = append(botFoods, *f)
				}
			}
			nearbyCreatureIDs := creatureGrid.GetNearby(c.X, c.Y, 25.0)
			botCreatures := make([]Creature, 0, len(nearbyCreatureIDs))
			for _, cid := range nearbyCreatureIDs {
				if ci, ok := creatureMap[cid]; ok {
					botCreatures = append(botCreatures, creatureSlice[ci])
				}
			}
			r.botController.UpdateBot(c, botFoods, botCreatures)
		}

		// Advance muscle cycle smoothly based on real time (~2.5 Hz natural cadence)
		c.StepsCount++
		c.MuscleStep = int(float64(c.StepsCount) * dt * 5.0)

		// Calculate physics forces (Phase 1, 3, 5)
		c.Forces = CalculatePhysicsForces(c.Elements, c.MuscleStep)

		// Apply Hydrodynamic Drag (Phase 2)
		ApplyHydrodynamicDrag(c, dt)

		if c.IsBraking {
			c.VelX = 0
			c.VelY = 0
			c.AngularVel = 0
			c.IsDashing = false
			c.State = "braking"
			c.IsSleeping = true
			c.DashFractionAccum = 0
		} else {
			// Process dash acceleration and food consumption (1 sec dash = dashFoodCostPerSecond food units)
			if c.IsDashing && c.FoodEaten > 0 {
				c.State = "dashing"
				costPerSec := cfg.Physics.DashFoodCostPerSecond
				if costPerSec <= 0 {
					costPerSec = 2.0
				}
				c.DashFractionAccum += costPerSec * dt
				if c.DashFractionAccum >= 1.0 {
					consumed := int(c.DashFractionAccum)
					if consumed > c.FoodEaten {
						consumed = c.FoodEaten
					}
					c.FoodEaten -= consumed
					c.Score -= consumed
					if c.Score < 0 {
						c.Score = 0
					}
					c.DashFractionAccum -= float64(consumed)
				}
				if c.FoodEaten <= 0 {
					c.FoodEaten = 0
					c.State = "moving"
					c.IsDashing = false
					c.DashFractionAccum = 0
				}
			} else {
				c.IsDashing = false
				if c.State == "dashing" || c.State == "braking" {
					c.State = "moving"
				}
				c.DashFractionAccum = 0
			}

			// Muscle torque applied to rotation target steering
			if math.Abs(c.Forces.NetRotationDeg) > 0.001 {
				rotSpeedDegPerSec := c.Forces.NetRotationDeg * 2.2
				c.TargetAngleDeg += rotSpeedDegPerSec * dt
				for c.TargetAngleDeg >= 360.0 {
					c.TargetAngleDeg -= 360.0
				}
				for c.TargetAngleDeg < 0.0 {
					c.TargetAngleDeg += 360.0
				}
			}

			// Smooth angle rotation toward target angle
			angleDiff := c.TargetAngleDeg - c.AngleDeg
			for angleDiff > 180 {
				angleDiff -= 360
			}
			for angleDiff < -180 {
				angleDiff += 360
			}

			// Smooth turn rate with rotational inertia (deg/sec)
			turnSpeed := math.Max(45.0, math.Min(180.0, 75.0+math.Abs(c.Forces.NetRotationDeg)*2.0))
			if c.State == "dashing" && c.IsDashing && c.FoodEaten > 0 {
				turnSpeed *= 1.3
			}

			maxTurnThisFrame := turnSpeed * dt
			if math.Abs(angleDiff) > maxTurnThisFrame {
				if angleDiff > 0 {
					c.AngleDeg += maxTurnThisFrame
				} else {
					c.AngleDeg -= maxTurnThisFrame
				}
			} else {
				c.AngleDeg = c.TargetAngleDeg
			}
			c.AngleDeg = math.Mod(c.AngleDeg+360.0, 360.0)

			// Forward velocity propulsion in grid cells per second
			dx, dy := GetVectorFromAngle(c.AngleDeg)

			// Target cruising speed (approx 1.5 - 3.5 grid cells / second)
			targetSpeed := c.Forces.ForwardSpeed * 8.5
			if c.State == "dashing" && c.IsDashing && c.FoodEaten > 0 {
				dashMult := cfg.Physics.DashMultiplier
				if dashMult <= 0 {
					dashMult = 1.6
				}
				targetSpeed *= dashMult
			}

			// Responsive acceleration toward propulsion heading
			accelRate := 10.0
			c.VelX += (dx*targetSpeed - c.VelX) * (1.0 - math.Exp(-accelRate*dt))
			c.VelY += (dy*targetSpeed - c.VelY) * (1.0 - math.Exp(-accelRate*dt))

			// Physical displacement per frame (grid cells)
			c.X += c.VelX * dt
			c.Y += c.VelY * dt
		}

		// World boundary toroidal wrap check
		halfWorld := r.worldRadius
		worldSize := r.worldRadius * 2.0

		if c.X > halfWorld {
			c.X -= worldSize
			c.PrevX -= worldSize
		} else if c.X < -halfWorld {
			c.X += worldSize
			c.PrevX += worldSize
		}

		if c.Y > halfWorld {
			c.Y -= worldSize
			c.PrevY -= worldSize
		} else if c.Y < -halfWorld {
			c.Y += worldSize
			c.PrevY += worldSize
		}

		// Enforce one-way top base wall: permeable from above, impermeable from base side below
		ResolveOneWayBaseTopWall(c, r.worldRadius)

		// Safe Zone Check (Base is a peaceful zone for upgrades)
		inBase := IsInsideBase(c.X, c.Y, r.worldRadius)
		c.InBase = inBase
		c.BankFood = c.FoodEaten

		// Check and update Sleeping State (Phase 4)
		CheckAndSetSleepingState(c)

		c.StepsCount++

		// Food eating — spatial query
		nearbyFoodIDs := r.spatialGrid.GetNearby(c.X, c.Y, 3.0)
		if len(nearbyFoodIDs) > 0 {
			nearbyFoods := make([]Food, 0, len(nearbyFoodIDs))
			for _, fid := range nearbyFoodIDs {
				if f, ok := r.foods[fid]; ok {
					nearbyFoods = append(nearbyFoods, *f)
				}
			}
			eaten := FindEatenFood(c.PrevX, c.PrevY, c.PrevAngleDeg, c.X, c.Y, c.AngleDeg, c.Elements, nearbyFoods)
			if eaten != nil {
				delete(r.foods, eaten.ID)
				foodGain := eaten.Value
				if foodGain <= 0 {
					foodGain = cfg.Economy.FoodBerryValue
					if foodGain <= 0 {
						foodGain = 1
					}
					if eaten.Type == FoodSuper {
						foodGain = int(math.Max(2, float64(foodGain)*2))
					} else if eaten.Type == FoodGolden {
						foodGain = cfg.Economy.FoodGoldenValue
						if foodGain <= 0 {
							foodGain = 5
						}
					}
				}
				c.FoodEaten += foodGain
				c.BankFood = c.FoodEaten
				c.Score += foodGain
				c.Energy = math.Min(c.MaxEnergy, c.Energy+float64(foodGain)*1.2)
				c.IsSleeping = false
			}
		}
	}

	// 5. Resolve creature collisions — Newtonian physics with CCD & Sleeping (Phase 1, 2, 4)
	ResolveCreatureCollisions(r.creatures)
	for _, c := range r.creatures {
		ResolveOneWayBaseTopWall(c, r.worldRadius)
	}

	// 6. Resolve creature head bites with Bio-Nuggets drop callback
	ResolveCreatureBites(r.creatures, func(x, y float64, fType FoodType) {
		val := cfg.Economy.FoodBerryValue
		if val <= 0 {
			val = 1
		}
		if fType == FoodGolden {
			val = cfg.Economy.FoodGoldenValue
			if val <= 0 {
				val = 5
			}
		} else if fType == FoodSuper {
			val = int(math.Max(2, float64(val)*2))
		}
		id := fmt.Sprintf("food-bionugget-%d-%d", time.Now().UnixNano(), r.rnd.Intn(10000))
		r.foods[id] = &Food{
			ID:        id,
			X:         x,
			Y:         y,
			Value:     val,
			Type:      fType,
			SpawnTime: time.Now().UnixMilli(),
		}
	})

	// 7. Build leaderboard + stats
	leaderboard := r.buildLeaderboard()

	intervalMs := int(r.tickIntervalMs / time.Millisecond)
	calcTickRate := 1000.0 / math.Max(1.0, float64(intervalMs))

	stats := ServerStats{
		TickRate:       calcTickRate,
		TickIntervalMs: intervalMs,
		ActivePlayers:  len(r.creatures) - currentBots,
		ActiveBots:     currentBots,
		TotalCreatures: len(r.creatures),
		TotalFood:      len(r.foods),
		Step:           r.step,
		UptimeSeconds:  now.Sub(r.startTime).Seconds(),
	}

	r.mu.Unlock()

	// 8. Broadcast complete world state at ~30Hz (every 3rd tick when 100 FPS) to clients
	broadcastStep := 3
	if cfg.World.TickRate <= 30 {
		broadcastStep = 1
	} else if cfg.World.TickRate <= 60 {
		broadcastStep = 2
	}

	if r.broadcastCb != nil && (r.step%uint64(broadcastStep) == 0) {
		creaturesNet := make([]CreatureNet, 0, len(r.creatures))
		for _, c := range r.creatures {
			creaturesNet = append(creaturesNet, ToCreatureNet(*c))
		}
		sort.Slice(creaturesNet, func(i, j int) bool {
			return creaturesNet[i].ID < creaturesNet[j].ID
		})

		foodsSnapshot := make([]Food, 0, len(r.foods))
		for _, f := range r.foods {
			foodsSnapshot = append(foodsSnapshot, *f)
		}

		r.broadcastCb(WSOutputMessage{
			Type:        "state",
			WorldRadius: r.worldRadius,
			Tick:        r.step,
			Creatures:   creaturesNet,
			Foods:       foodsSnapshot,
			Leaderboard: leaderboard,
			Stats:       &stats,
			Config:      &cfg,
		}, "")
	}
}

func (r *Room) buildLeaderboard() []LeaderboardEntry {
	entries := make([]LeaderboardEntry, 0, len(r.creatures))
	for _, c := range r.creatures {
		entries = append(entries, LeaderboardEntry{
			ID:        c.ID,
			Name:      c.Name,
			Score:     c.Score,
			Color:     c.Color,
			IsBot:     c.IsBot,
			Kills:     c.Kills,
			FoodEaten: c.FoodEaten,
		})
	}

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Score > entries[j].Score
	})

	for i := range entries {
		entries[i].Rank = i + 1
	}

	if len(entries) > 10 {
		return entries[:10]
	}
	return entries
}
