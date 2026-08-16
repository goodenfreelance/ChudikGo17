package game

import "time"

type ElementType string

const (
	ElementHead               ElementType = "head"
	ElementHeadJaw            ElementType = "head-jaw"
	ElementJoint              ElementType = "joint"
	ElementEdgeH              ElementType = "edge-h"
	ElementEdgeV              ElementType = "edge-v"
	ElementEdgeD1             ElementType = "edge-d1"
	ElementEdgeD2             ElementType = "edge-d2"
	ElementMuscleLeft         ElementType = "muscle-left"
	ElementMuscleRight        ElementType = "muscle-right"
	ElementMuscleRandomLeft   ElementType = "muscle-random-left"
	ElementMuscleRandomRight  ElementType = "muscle-random-right"
)

type CreatureElement struct {
	ID           string      `json:"id"`
	RelX         float64     `json:"relX"`
	RelY         float64     `json:"relY"`
	Type         ElementType `json:"type"`
	Weight       float64     `json:"weight"`
	MusclePhase  float64     `json:"musclePhase,omitempty"`
	HeadAngle    *float64    `json:"headAngle,omitempty"`
	RandomChance *float64    `json:"randomChance,omitempty"`
	IsStarter    bool        `json:"isStarter,omitempty"`
}

type JointPhysics struct {
	JointID              string  `json:"jointId"`
	JX                   float64 `json:"jx"`
	JY                   float64 `json:"jy"`
	LeftEdgeMass         float64 `json:"leftEdgeMass"`
	RightEdgeMass        float64 `json:"rightEdgeMass"`
	LeftTorquePotential  float64 `json:"leftTorquePotential"`
	RightTorquePotential float64 `json:"rightTorquePotential"`
	ActiveLeftMuscles    int     `json:"activeLeftMuscles"`
	ActiveRightMuscles   int     `json:"activeRightMuscles"`
	NetJointTorque       float64 `json:"netJointTorque"`
}

type PhysicsForces struct {
	LeftTorque            float64        `json:"leftTorque"`
	RightTorque           float64        `json:"rightTorque"`
	NetRotationDeg        float64        `json:"netRotationDeg"`
	ForwardSpeed          float64        `json:"forwardSpeed"`
	LeftMass              float64        `json:"leftMass"`
	RightMass             float64        `json:"rightMass"`
	TotalMass             float64        `json:"totalMass"`
	TotalInertia          float64        `json:"totalInertia"`
	CenterOfMassX         float64        `json:"centerOfMassX"`
	CenterOfMassY         float64        `json:"centerOfMassY"`
	IsLighterSideRotating bool           `json:"isLighterSideRotating"`
	JointsPhysics         []JointPhysics `json:"jointsPhysics,omitempty"`
	ActiveMusclesCount    int            `json:"activeMusclesCount"`
}

type Creature struct {
	ID                   string            `json:"id"`
	PlayerID             string            `json:"playerId"`
	Name                 string            `json:"name"`
	Color                string            `json:"color"`
	IsBot                bool              `json:"isBot"`
	X                    float64           `json:"x"`
	Y                    float64           `json:"y"`
	AngleDeg             float64           `json:"angleDeg"`
	TargetAngleDeg       float64           `json:"targetAngleDeg"`
	TargetX              float64           `json:"targetX"`
	TargetY              float64           `json:"targetY"`
	VelX                 float64           `json:"velX"`
	VelY                 float64           `json:"velY"`
	AngularVel           float64           `json:"angularVel"`
	IsSleeping           bool              `json:"isSleeping"`
	Energy               float64           `json:"energy"`
	MaxEnergy            float64           `json:"maxEnergy"`
	FoodEaten            int               `json:"foodEaten"`
	BankFood             int               `json:"bankFood"`
	InBase               bool              `json:"inBase"`
	Score                int               `json:"score"`
	StepsCount           int               `json:"stepsCount"`
	MuscleStep           int               `json:"muscleStep"`
	State                string            `json:"state"` // "idle", "hunting", "eating", "moving", "dashing", "braking"
	IsDashing            bool              `json:"isDashing"`
	IsBraking            bool              `json:"isBraking"`
	DashFractionAccum    float64           `json:"-"`
	Elements             []CreatureElement `json:"elements"`
	Forces               PhysicsForces     `json:"forces"`
	PrevX                float64           `json:"prevX"`
	PrevY                float64           `json:"prevY"`
	PrevAngleDeg         float64           `json:"prevAngleDeg"`
	Kills                int               `json:"kills"`
	LastActive           time.Time         `json:"-"`
	AdminControlledUntil time.Time         `json:"-"`
}

type FoodType string

const (
	FoodBerry  FoodType = "berry"
	FoodSuper  FoodType = "super"
	FoodGolden FoodType = "golden"
)

type Food struct {
	ID        string   `json:"id"`
	X         float64  `json:"x"`
	Y         float64  `json:"y"`
	Value     int      `json:"value"`
	Type      FoodType `json:"type"`
	SpawnTime int64    `json:"spawnTime"`
}

type LeaderboardEntry struct {
	Rank      int    `json:"rank"`
	ID        string `json:"id"`
	Name      string `json:"name"`
	Score     int    `json:"score"`
	Color     string `json:"color"`
	IsBot     bool   `json:"isBot"`
	Kills     int    `json:"kills"`
	FoodEaten int    `json:"foodEaten"`
}

type ServerStats struct {
	TickRate       float64 `json:"tickRate"`
	TickIntervalMs int     `json:"tickIntervalMs"`
	ActivePlayers  int     `json:"activePlayers"`
	ActiveBots     int     `json:"activeBots"`
	TotalCreatures int     `json:"totalCreatures"`
	TotalFood      int     `json:"totalFood"`
	Step           uint64  `json:"step"`
	UptimeSeconds  float64 `json:"uptimeSeconds"`
}

type WSInputMessage struct {
	Type             string            `json:"type"` // "join", "input", "spawn_food", "chat", "ping", "admin_set_speed", "admin_delete_creature", "admin_control_input", "admin_spawn_creature", "admin_kick_user", "admin_update_config", "edit_creature", "deposit_bank_food", "spend_bank_food"
	Name             string            `json:"name,omitempty"`
	Color            string            `json:"color,omitempty"`
	Elements         []CreatureElement `json:"elements,omitempty"`
	PresetIndex      int               `json:"presetIndex,omitempty"`
	TargetAngleDeg   *float64          `json:"targetAngleDeg,omitempty"`
	TargetX          *float64          `json:"targetX,omitempty"`
	TargetY          *float64          `json:"targetY,omitempty"`
	MuscleContract   bool              `json:"muscleContract,omitempty"`
	Dash             bool              `json:"dash,omitempty"`
	Brake            *bool             `json:"brake,omitempty"`
	ToggleBrake      bool              `json:"toggleBrake,omitempty"`
	FoodX            *float64          `json:"foodX,omitempty"`
	FoodY            *float64          `json:"foodY,omitempty"`
	FoodType         FoodType          `json:"foodType,omitempty"`
	ChatMessage      string            `json:"chatMessage,omitempty"`
	ClientTime       int64             `json:"clientTime,omitempty"`
	TargetCreatureID string            `json:"targetCreatureId,omitempty"`
	SpeedMs          int               `json:"speedMs,omitempty"`
	TargetPlayerID   string            `json:"targetPlayerId,omitempty"`
	Reason           string            `json:"reason,omitempty"`
	Config           *WorldConfig      `json:"config,omitempty"`
	BankFoodAmount   int               `json:"bankFoodAmount,omitempty"`
	FoodEaten        *int              `json:"foodEaten,omitempty"`
	Score            *int              `json:"score,omitempty"`
}

type WSOutputMessage struct {
	Type          string             `json:"type"` // "init", "state", "event", "chat", "pong", "kicked", "config"
	YourID        string             `json:"yourId,omitempty"`
	WorldRadius   float64            `json:"worldRadius,omitempty"`
	Tick          uint64             `json:"tick,omitempty"`
	Creatures     []CreatureNet      `json:"creatures,omitempty"`
	Foods         []Food             `json:"foods,omitempty"`
	Leaderboard   []LeaderboardEntry `json:"leaderboard,omitempty"`
	Stats         *ServerStats       `json:"stats,omitempty"`
	Config        *WorldConfig       `json:"config,omitempty"`
	EventName     string             `json:"eventName,omitempty"`
	EventData     interface{}        `json:"eventData,omitempty"`
	ChatSender    string             `json:"chatSender,omitempty"`
	ChatMessage   string             `json:"chatMessage,omitempty"`
	ChatColor     string             `json:"chatColor,omitempty"`
	ChatTimestamp string             `json:"chatTimestamp,omitempty"`
	ClientTime    int64              `json:"clientTime,omitempty"`
	ServerTime    int64              `json:"serverTime,omitempty"`
	KickedReason  string             `json:"kickedReason,omitempty"`
}

// =============================================
// Optimized Network Types (trimmed for broadcast)
// =============================================

type JointPhysicsNet struct {
	JointID            string  `json:"jointId"`
	ActiveLeftMuscles  int     `json:"activeLeftMuscles"`
	ActiveRightMuscles int     `json:"activeRightMuscles"`
	LeftEdgeMass       float64 `json:"leftEdgeMass"`
	RightEdgeMass      float64 `json:"rightEdgeMass"`
}

type PhysicsForcesNet struct {
	TotalMass      float64           `json:"totalMass"`
	TotalInertia   float64           `json:"totalInertia"`
	ForwardSpeed   float64           `json:"forwardSpeed"`
	NetRotationDeg float64           `json:"netRotationDeg"`
	CenterOfMassX  float64           `json:"centerOfMassX"`
	CenterOfMassY  float64           `json:"centerOfMassY"`
	JointsPhysics  []JointPhysicsNet `json:"jointsPhysics,omitempty"`
}

type CreatureNet struct {
	ID         string            `json:"id"`
	Name       string            `json:"name"`
	Color      string            `json:"color"`
	IsBot      bool              `json:"isBot"`
	X          float64           `json:"x"`
	Y          float64           `json:"y"`
	AngleDeg   float64           `json:"angleDeg"`
	VelX       float64           `json:"velX"`
	VelY       float64           `json:"velY"`
	AngularVel float64           `json:"angularVel"`
	IsSleeping bool              `json:"isSleeping"`
	Energy     float64           `json:"energy"`
	MaxEnergy  float64           `json:"maxEnergy"`
	FoodEaten  int               `json:"foodEaten"`
	BankFood   int               `json:"bankFood"`
	InBase     bool              `json:"inBase"`
	Score      int               `json:"score"`
	StepsCount int               `json:"stepsCount"`
	MuscleStep int               `json:"muscleStep"`
	State      string            `json:"state"`
	IsDashing  bool              `json:"isDashing"`
	IsBraking  bool              `json:"isBraking"`
	Kills      int               `json:"kills"`
	Elements   []CreatureElement `json:"elements"`
	Forces     PhysicsForcesNet  `json:"forces"`
}

func ToCreatureNet(c Creature) CreatureNet {
	joints := make([]JointPhysicsNet, 0, len(c.Forces.JointsPhysics))
	for _, jp := range c.Forces.JointsPhysics {
		joints = append(joints, JointPhysicsNet{
			JointID:            jp.JointID,
			ActiveLeftMuscles:  jp.ActiveLeftMuscles,
			ActiveRightMuscles: jp.ActiveRightMuscles,
			LeftEdgeMass:       jp.LeftEdgeMass,
			RightEdgeMass:      jp.RightEdgeMass,
		})
	}
	return CreatureNet{
		ID:         c.ID,
		Name:       c.Name,
		Color:      c.Color,
		IsBot:      c.IsBot,
		X:          c.X,
		Y:          c.Y,
		AngleDeg:   c.AngleDeg,
		VelX:       c.VelX,
		VelY:       c.VelY,
		AngularVel: c.AngularVel,
		IsSleeping: c.IsSleeping,
		Energy:     c.Energy,
		MaxEnergy:  c.MaxEnergy,
		FoodEaten:  c.FoodEaten,
		BankFood:   c.BankFood,
		InBase:     c.InBase,
		Score:      c.Score,
		StepsCount: c.StepsCount,
		MuscleStep: c.MuscleStep,
		State:      c.State,
		IsDashing:  (c.IsDashing || c.State == "dashing") && c.FoodEaten > 0,
		IsBraking:  c.IsBraking,
		Kills:      c.Kills,
		Elements:   c.Elements,
		Forces: PhysicsForcesNet{
			TotalMass:      c.Forces.TotalMass,
			TotalInertia:   c.Forces.TotalInertia,
			ForwardSpeed:   c.Forces.ForwardSpeed * (func() float64 { if (c.IsDashing || c.State == "dashing") && c.FoodEaten > 0 { return 1.6 }; return 1.0 }()),
			NetRotationDeg: c.Forces.NetRotationDeg,
			CenterOfMassX:  c.Forces.CenterOfMassX,
			CenterOfMassY:  c.Forces.CenterOfMassY,
			JointsPhysics:  joints,
		},
	}
}
