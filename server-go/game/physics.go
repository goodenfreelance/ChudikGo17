package game

import (
	"fmt"
	"math"
	"math/rand"
	"strings"
)

// Default Creature Presets
var DefaultPresets = []struct {
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Elements    []CreatureElement `json:"elements"`
}{
	{
		Name:        "Чудик-Маятник",
		Description: "Центральный шарнир с головой вверху, симметричными ребрами и противоположными мышцами на шарнире. Бежит вперед!",
		Elements: []CreatureElement{
			{ID: "head-top", RelX: 0, RelY: -1, Type: ElementHead, Weight: 1, HeadAngle: floatPtr(270)},
			{ID: "joint-center", RelX: 0, RelY: 0, Type: ElementJoint, Weight: 0},
			{ID: "edge-l1", RelX: -1, RelY: 0, Type: ElementEdgeH, Weight: 1},
			{ID: "edge-r1", RelX: 1, RelY: 0, Type: ElementEdgeH, Weight: 1},
			{ID: "edge-v1", RelX: 0, RelY: -1, Type: ElementEdgeV, Weight: 1},
			{ID: "muscle-l", RelX: 0, RelY: 0, Type: ElementMuscleLeft, Weight: 0},
			{ID: "muscle-r", RelX: 0, RelY: 0, Type: ElementMuscleRight, Weight: 0},
		},
	},
	{
		Name:        "Асимметричный Вращатель",
		Description: "Имеет голову и больше ребер на левом плече. Мышца на центральном шарнире вращает легкое правое плечо.",
		Elements: []CreatureElement{
			{ID: "head-top", RelX: 0, RelY: -1, Type: ElementHead, Weight: 1, HeadAngle: floatPtr(270)},
			{ID: "joint-center", RelX: 0, RelY: 0, Type: ElementJoint, Weight: 0},
			{ID: "edge-l1", RelX: -1, RelY: 0, Type: ElementEdgeH, Weight: 1},
			{ID: "edge-l2", RelX: -1, RelY: 1, Type: ElementEdgeV, Weight: 1},
			{ID: "edge-r1", RelX: 1, RelY: 0, Type: ElementEdgeH, Weight: 1},
			{ID: "muscle-l", RelX: 0, RelY: 0, Type: ElementMuscleLeft, Weight: 0},
		},
	},
	{
		Name:        "Диагональный Бегун (45°)",
		Description: "Использует диагональные ребра (/) и (\\) с ведущей головой и мышцами на центральном шарнире для быстрого перемещения.",
		Elements: []CreatureElement{
			{ID: "head-top", RelX: 0, RelY: -1, Type: ElementHead, Weight: 1, HeadAngle: floatPtr(270)},
			{ID: "joint-center", RelX: 0, RelY: 0, Type: ElementJoint, Weight: 0},
			{ID: "edge-d1", RelX: -1, RelY: -1, Type: ElementEdgeD2, Weight: 1},
			{ID: "edge-d2", RelX: 1, RelY: -1, Type: ElementEdgeD1, Weight: 1},
			{ID: "edge-d3", RelX: -1, RelY: 1, Type: ElementEdgeD1, Weight: 1},
			{ID: "edge-d4", RelX: 1, RelY: 1, Type: ElementEdgeD2, Weight: 1},
			{ID: "muscle-l", RelX: 0, RelY: 0, Type: ElementMuscleLeft, Weight: 0},
			{ID: "muscle-r", RelX: 0, RelY: 0, Type: ElementMuscleRight, Weight: 0},
		},
	},
	{
		Name:        "Двухшарнирный Сороконожка",
		Description: "Два шарнира на разных узлах сетки с мышцами сгибания на каждом шарнире и головой, создающими движение вперед.",
		Elements: []CreatureElement{
			{ID: "head-top", RelX: 0, RelY: -2, Type: ElementHead, Weight: 1, HeadAngle: floatPtr(270)},
			{ID: "joint-1", RelX: 0, RelY: -1, Type: ElementJoint, Weight: 0},
			{ID: "joint-2", RelX: 0, RelY: 1, Type: ElementJoint, Weight: 0},
			{ID: "edge-v", RelX: 0, RelY: 0, Type: ElementEdgeV, Weight: 1},
			{ID: "edge-h1", RelX: -1, RelY: -1, Type: ElementEdgeH, Weight: 1},
			{ID: "edge-h2", RelX: 1, RelY: -1, Type: ElementEdgeH, Weight: 1},
			{ID: "edge-h3", RelX: -1, RelY: 1, Type: ElementEdgeH, Weight: 1},
			{ID: "edge-h4", RelX: 1, RelY: 1, Type: ElementEdgeH, Weight: 1},
			{ID: "muscle-1", RelX: 0, RelY: -1, Type: ElementMuscleLeft, Weight: 0},
			{ID: "muscle-2", RelX: 0, RelY: 1, Type: ElementMuscleRight, Weight: 0},
		},
	},
	{
		Name:        "Хаотичный Бегун (Случайные Мышцы 🎲)",
		Description: "Использует случайные мышцы на центральном шарнире с вероятностью срабатывания (35%). Движение и повороты непредсказуемы!",
		Elements: []CreatureElement{
			{ID: "head-top", RelX: 0, RelY: -1, Type: ElementHead, Weight: 1, HeadAngle: floatPtr(270)},
			{ID: "joint-center", RelX: 0, RelY: 0, Type: ElementJoint, Weight: 0},
			{ID: "edge-l1", RelX: -1, RelY: 0, Type: ElementEdgeH, Weight: 1},
			{ID: "edge-r1", RelX: 1, RelY: 0, Type: ElementEdgeH, Weight: 1},
			{ID: "edge-v1", RelX: 0, RelY: -1, Type: ElementEdgeV, Weight: 1},
			{ID: "muscle-rnd-l", RelX: 0, RelY: 0, Type: ElementMuscleRandomLeft, Weight: 0, RandomChance: floatPtr(35)},
			{ID: "muscle-rnd-r", RelX: 0, RelY: 0, Type: ElementMuscleRandomRight, Weight: 0, RandomChance: floatPtr(35)},
		},
	},
}

// StarterPreset returns the minimal starting creature (0 cost, no teeth)
func StarterPreset() []CreatureElement {
	return []CreatureElement{
		{ID: "joint-c", RelX: 0, RelY: 0, Type: ElementJoint, Weight: 0, IsStarter: true},
		{ID: "edge-spine", RelX: 0, RelY: -1, Type: ElementEdgeV, Weight: 1, IsStarter: true},
		{ID: "edge-wing-l", RelX: -1, RelY: 0, Type: ElementEdgeH, Weight: 1, IsStarter: true},
		{ID: "edge-wing-r", RelX: 1, RelY: 0, Type: ElementEdgeH, Weight: 1, IsStarter: true},
		{ID: "muscle-l", RelX: 0, RelY: 0, Type: ElementMuscleLeft, Weight: 0, IsStarter: true},
		{ID: "muscle-r", RelX: 0, RelY: 0, Type: ElementMuscleRight, Weight: 0, IsStarter: true},
	}
}

// GetElementCost returns the food purchase price of an element type
func GetElementCost(t ElementType) int {
	cfg := GetGlobalConfig()
	if cfg.World.UnlimitedElements {
		return 0
	}
	if cfg.Economy.ElementPrices != nil {
		if cost, ok := cfg.Economy.ElementPrices[string(t)]; ok && cost >= 0 {
			return cost
		}
	}
	switch t {
	case ElementHeadJaw:
		return 18
	case ElementHead:
		return 5
	case ElementMuscleRandomLeft, ElementMuscleRandomRight:
		return 3
	case ElementMuscleLeft, ElementMuscleRight:
		return 2
	case ElementJoint:
		return 1
	case ElementEdgeH, ElementEdgeV, ElementEdgeD1, ElementEdgeD2:
		return 1
	default:
		return 1
	}
}

// GetBaseBoundsCoords returns the 4 boundary coordinates of the Safe Zone base
func GetBaseBoundsCoords(worldRadius float64) (minX, maxX, minY, maxY float64) {
	baseSize := worldRadius * 0.35
	if baseSize < 15.0 {
		baseSize = 15.0
	}
	minX = worldRadius - baseSize
	maxX = worldRadius
	minY = worldRadius - baseSize
	maxY = worldRadius
	return minX, maxX, minY, maxY
}

// IsInsideBase checks if the given coordinates are within the bottom-right Safe Zone
func IsInsideBase(x, y, worldRadius float64) bool {
	minX, maxX, minY, maxY := GetBaseBoundsCoords(worldRadius)
	return x >= minX && x <= maxX && y >= minY && y <= maxY
}

// GetBaseSpawnPoint returns the center of the Safe Zone
func GetBaseSpawnPoint(worldRadius float64) (float64, float64) {
	minX, maxX, minY, maxY := GetBaseBoundsCoords(worldRadius)
	return (minX + maxX) * 0.5, (minY + maxY) * 0.5
}

// ResolveOneWayBaseTopWall implements the one-way barrier physics on the top boundary of the base (y = minY):
// - Permeable from above: creatures outside above the base (prevY < minY) moving downwards (y >= minY) can freely pass through into the base.
// - Impermeable from below on the side of the base: creatures inside the base (prevY >= minY) cannot pass upwards past y = minY and are blocked/bounced back down.
func ResolveOneWayBaseTopWall(c *Creature, worldRadius float64) {
	minX, maxX, minY, _ := GetBaseBoundsCoords(worldRadius)
	const margin = 0.5

	// Check if creature's horizontal span overlaps the base top wall (from minX to maxX)
	if c.X >= (minX - margin) && c.X <= (maxX + margin) {
		// If the creature was on or below the top wall on the base side (c.PrevY >= minY)
		// and is now moving or being pushed above the top wall (c.Y < minY)
		if c.PrevY >= minY && c.Y < minY {
			// Wall is impermeable from below on the base side: block movement and damp vertical velocity
			c.Y = minY
			if c.VelY < 0 {
				c.VelY = -c.VelY * 0.2 // gentle rebound downward
			}
		}
	}
}

func floatPtr(v float64) *float64 {
	return &v
}

func IsRandomMuscleTriggered(el CreatureElement, cycle int) bool {
	if cycle <= 0 {
		return true
	}
	chance := 35.0
	if el.RandomChance != nil {
		chance = *el.RandomChance
	}
	chance = math.Max(10.0, math.Min(90.0, chance))
	hash := int32(0)
	str := fmt.Sprintf("%s_c_%d", el.ID, cycle)
	for i := 0; i < len(str); i++ {
		hash = (hash << 5) - hash + int32(str[i])
	}
	val := math.Abs(float64(hash))
	valMod := math.Mod(val, 100)
	return valMod < chance
}

type RandomMuscleState struct {
	IsFlexed     bool
	JustFlexed   bool
	JustUnflexed bool
}

func GetRandomMuscleState(el CreatureElement, step int) RandomMuscleState {
	if step <= 0 {
		return RandomMuscleState{}
	}
	isTriggeredNow := IsRandomMuscleTriggered(el, step)
	isTriggeredPrev := IsRandomMuscleTriggered(el, step-1)
	return RandomMuscleState{
		IsFlexed:     isTriggeredNow,
		JustFlexed:   isTriggeredNow && !isTriggeredPrev,
		JustUnflexed: !isTriggeredNow && isTriggeredPrev,
	}
}

func DetermineCreatureHeadAngle(elements []CreatureElement) float64 {
	for _, el := range elements {
		if el.Type == ElementHead || el.Type == ElementHeadJaw {
			if el.HeadAngle != nil {
				return *el.HeadAngle
			}
			if el.RelX != 0 || el.RelY != 0 {
				rad := math.Atan2(el.RelY, el.RelX)
				deg := math.Round((rad * 180) / math.Pi)
				if deg < 0 {
					deg += 360
				}
				return deg
			}
		}
	}
	return 270.0
}

func NormalizeAngleDeg(angle float64) float64 {
	for angle > 180.0 {
		angle -= 360.0
	}
	for angle < -180.0 {
		angle += 360.0
	}
	return angle
}

// Point represents a 2D coordinate vector
type Point struct {
	X float64
	Y float64
}

// CalculateHuygensSteinerInertia calculates Center of Mass and accurate Moment of Inertia
// using the Huygens-Steiner Theorem: I_total = sum( I_local,i + m_i * d_i^2 )
func CalculateHuygensSteinerInertia(elements []CreatureElement) (totalMass float64, comX float64, comY float64, totalInertia float64) {
	if len(elements) == 0 {
		return 1.0, 0.0, 0.0, 0.5
	}

	sumMass := 0.0
	weightedX := 0.0
	weightedY := 0.0

	elementMassesList := make([]float64, len(elements))

	for i, el := range elements {
		m := GetElementMass(el.Type, el.Weight)
		if m <= 0.0 {
			// Minimal nonzero mass for kinematic tracking
			m = 0.05
		}
		elementMassesList[i] = m
		sumMass += m
		weightedX += m * el.RelX
		weightedY += m * el.RelY
	}

	if sumMass < 0.1 {
		sumMass = 1.0
	}

	comX = weightedX / sumMass
	comY = weightedY / sumMass

	// Huygens-Steiner Parallel Axis Calculation
	// I_total = sum( I_local,i + m_i * ((x_i - comX)^2 + (y_i - comY)^2) )
	sumInertia := 0.0
	for i, el := range elements {
		m := elementMassesList[i]

		// Local moment of inertia I_local,i
		iLocal := 0.0
		switch el.Type {
		case ElementHead, ElementHeadJaw, ElementJoint, "eye", "mouth":
			// Solid disc/point approximation: I_local = 0.5 * m * R^2 (R = 0.5)
			iLocal = 0.5 * m * 0.25
		case ElementEdgeH, ElementEdgeV:
			// Thin rod rotating about center: I_local = (1/12) * m * L^2 (L = 1.0)
			iLocal = (1.0 / 12.0) * m * 1.0
		case ElementEdgeD1, ElementEdgeD2:
			// Diagonal rod of length sqrt(2): I_local = (1/12) * m * 2.0
			iLocal = (1.0 / 12.0) * m * 2.0
		default:
			// Muscle or generic element: I_local = (1/12) * m * 1.0
			iLocal = (1.0 / 12.0) * m * 1.0
		}

		dx := el.RelX - comX
		dy := el.RelY - comY
		distSq := dx*dx + dy*dy

		// Huygens-Steiner Parallel Axis Theorem term: m * d^2
		sumInertia += iLocal + (m * distSq)
	}

	totalMass = math.Max(0.5, sumMass)
	totalInertia = math.Max(0.2, sumInertia)
	return totalMass, comX, comY, totalInertia
}

// CalculatePhysicsForces computes forces, Hooke's Law spring-damper muscle torque,
// total inertia via Huygens-Steiner, and resulting propulsion kinematics.
func CalculatePhysicsForces(elements []CreatureElement, muscleActiveStep int) PhysicsForces {
	cfg := GetGlobalConfig()

	// 1. Calculate Huygens-Steiner Inertia and Center of Mass
	totalMass, comX, comY, totalInertia := CalculateHuygensSteinerInertia(elements)

	type JointNode struct {
		ID string
		X  float64
		Y  float64
	}

	joints := []JointNode{}
	edgeElements := []CreatureElement{}
	muscleElements := []CreatureElement{}

	totalLeftMass := 0.0
	totalRightMass := 0.0

	for _, el := range elements {
		m := GetElementMass(el.Type, el.Weight)
		if el.Type == ElementJoint {
			joints = append(joints, JointNode{ID: el.ID, X: el.RelX, Y: el.RelY})
		} else if strings.HasPrefix(string(el.Type), "edge-") {
			edgeElements = append(edgeElements, el)
		} else if strings.HasPrefix(string(el.Type), "muscle-") {
			muscleElements = append(muscleElements, el)
		}

		// Relative to Center of Mass
		if el.RelX < comX-0.01 {
			totalLeftMass += m
		} else if el.RelX > comX+0.01 {
			totalRightMass += m
		} else {
			totalLeftMass += m * 0.5
			totalRightMass += m * 0.5
		}
	}

	if len(joints) == 0 {
		joints = append(joints, JointNode{ID: "center-joint", X: comX, Y: comY})
	}

	jointsPhysics := []JointPhysics{}
	sumLeftTorque := 0.0
	sumRightTorque := 0.0
	totalActiveMusclesCount := 0
	motionActiveMusclesCount := 0

	hasMultipleJoints := len(joints) > 1

	// Smooth muscle contraction phase s in [0, 1] using sinusoidal step
	// Phase 3: Hooke's Law with Damping: F = -k*(x - x0) - c*v_rel
	muscleCycle := float64(muscleActiveStep) * 0.5
	contractFactor := 0.5 - 0.5*math.Cos(muscleCycle*math.Pi) // Smooth 0..1..0
	isMuscleContracted := contractFactor > 0.1

	kStiffness := cfg.Physics.MuscleStiffness
	cDamping := cfg.Physics.MuscleDamping
	if kStiffness <= 0 {
		kStiffness = 50.0
	}
	if cDamping <= 0 {
		cDamping = 5.0
	}

	for _, j := range joints {
		jLeftMass := 0.0
		jRightMass := 0.0
		jLeftTorquePotential := 0.0
		jRightTorquePotential := 0.0

		for _, el := range edgeElements {
			m := GetElementMass(el.Type, el.Weight)
			dx := el.RelX - j.X

			if dx < 0 {
				arm := -dx
				leverMultiplier := 1.0 + 0.5*(arm-1.0)
				jLeftMass += m
				jLeftTorquePotential += m * leverMultiplier
			} else if dx > 0 {
				arm := dx
				leverMultiplier := 1.0 + 0.5*(arm-1.0)
				jRightMass += m
				jRightTorquePotential += m * leverMultiplier
			} else {
				jLeftMass += m * 0.5
				jRightMass += m * 0.5
				jLeftTorquePotential += m * 0.5
				jRightTorquePotential += m * 0.5
			}
		}

		activeLeftMuscles := 0.0
		activeRightMuscles := 0.0

		for _, el := range muscleElements {
			if hasMultipleJoints {
				mdx := el.RelX - j.X
				mdy := el.RelY - j.Y
				if mdx*mdx+mdy*mdy > 6.25 {
					continue
				}
			}

			providesTorque := false
			providesMotion := false
			muscleIntensity := 1.0

			if el.Type == ElementMuscleLeft || el.Type == ElementMuscleRight {
				providesTorque = isMuscleContracted
				providesMotion = true
				muscleIntensity = contractFactor
			} else if el.Type == ElementMuscleRandomLeft || el.Type == ElementMuscleRandomRight {
				mState := GetRandomMuscleState(el, muscleActiveStep)
				providesTorque = mState.JustFlexed
				providesMotion = mState.JustFlexed || mState.JustUnflexed
				if mState.JustFlexed {
					muscleIntensity = 1.0
				} else {
					muscleIntensity = 0.5
				}
			}

			if providesTorque {
				// Phase 3: Spring-damper displacement calculation
				// Resting length L0 = 1.0, contracted target L_target = 0.65
				// Delta x = (L_rest - L_target) * muscleIntensity
				deltaX := 0.35 * muscleIntensity
				vRelEstimate := 0.15 * muscleIntensity // velocity projection along spring axis

				// Spring Force F = k * deltaX - c * v_rel (Damped harmonic oscillator)
				fSpring := (kStiffness * 0.04 * deltaX) - (cDamping * 0.02 * vRelEstimate)
				if fSpring < 0.1 {
					fSpring = 0.1
				}

				// Lever arm r from joint
				arm := math.Hypot(el.RelX-j.X, el.RelY-j.Y)
				if arm < 0.5 {
					arm = 1.0
				}
				torqueValue := fSpring * arm * 1.2

				if strings.Contains(string(el.Type), "left") {
					activeLeftMuscles += torqueValue
				} else if strings.Contains(string(el.Type), "right") {
					activeRightMuscles += torqueValue
				}
			}

			if providesMotion {
				motionActiveMusclesCount++
			}
		}

		leftLever := math.Max(0.05, jLeftTorquePotential)
		rightLever := math.Max(0.05, jRightTorquePotential)

		jointLeftForce := activeLeftMuscles * leftLever
		jointRightForce := activeRightMuscles * rightLever
		netJointTorque := jointLeftForce - jointRightForce

		jointsPhysics = append(jointsPhysics, JointPhysics{
			JointID:              j.ID,
			JX:                   j.X,
			JY:                   j.Y,
			LeftEdgeMass:         jLeftMass,
			RightEdgeMass:        jRightMass,
			LeftTorquePotential:  jLeftTorquePotential,
			RightTorquePotential: jRightTorquePotential,
			ActiveLeftMuscles:    int(math.Round(activeLeftMuscles)),
			ActiveRightMuscles:   int(math.Round(activeRightMuscles)),
			NetJointTorque:       netJointTorque,
		})

		sumLeftTorque += jointLeftForce
		sumRightTorque += jointRightForce
		if activeLeftMuscles+activeRightMuscles > 0 {
			totalActiveMusclesCount++
		}
	}

	netTorque := sumLeftTorque - sumRightTorque

	// Angular rotation delta from torque and Huygens-Steiner Inertia Tensor:
	// alpha = Torque / I_total
	netRotationDeg := 0.0
	if math.Abs(netTorque) > 0 {
		rawRotation := (netTorque / totalInertia) * 24.0
		netRotationDeg = math.Min(60.0, math.Max(-60.0, rawRotation))
	}

	isLighterSideRotating := totalLeftMass != totalRightMass && netTorque != 0

	// Linear propulsion speed: a = Thrust / Mass
	forwardSpeed := 0.0
	if motionActiveMusclesCount > 0 || sumLeftTorque > 0 || sumRightTorque > 0 {
		thrust := 0.0
		if sumLeftTorque > 0 && sumRightTorque > 0 {
			thrust = (sumLeftTorque + sumRightTorque) * 0.95
		} else if sumLeftTorque > 0 || sumRightTorque > 0 {
			thrust = math.Max(sumLeftTorque, sumRightTorque) * 0.70
		} else {
			thrust = 0.8 * float64(motionActiveMusclesCount)
		}

		calculatedSpeed := (thrust / totalMass) * 0.22
		cfg := GetGlobalConfig()
		maxSpd := cfg.Physics.MaxSpeed
		if maxSpd <= 0 {
			maxSpd = 1.2
		}
		forwardSpeed = math.Min(maxSpd, math.Max(0.02, calculatedSpeed))
	}

	return PhysicsForces{
		LeftTorque:            sumLeftTorque,
		RightTorque:           sumRightTorque,
		NetRotationDeg:        netRotationDeg,
		ForwardSpeed:          forwardSpeed,
		LeftMass:              totalLeftMass,
		RightMass:             totalRightMass,
		TotalMass:             totalMass,
		TotalInertia:          totalInertia,
		CenterOfMassX:         comX,
		CenterOfMassY:         comY,
		IsLighterSideRotating: isLighterSideRotating,
		JointsPhysics:         jointsPhysics,
		ActiveMusclesCount:    totalActiveMusclesCount,
	}
}

// ApplyHydrodynamicDrag applies linear and angular drag (Phase 2)
// v(t+dt) = v(t) * exp(-k_linear * dt)
// w(t+dt) = w(t) * exp(-k_angular * dt)
func ApplyHydrodynamicDrag(c *Creature, dt float64) {
	cfg := GetGlobalConfig()
	kLinear := cfg.Physics.DragLinear
	kAngular := cfg.Physics.DragAngular

	linearFactor := math.Exp(-kLinear * dt)
	angularFactor := math.Exp(-kAngular * dt)

	c.VelX *= linearFactor
	c.VelY *= linearFactor
	c.AngularVel *= angularFactor

	// Clean small epsilon velocities
	if math.Abs(c.VelX) < 1e-4 {
		c.VelX = 0
	}
	if math.Abs(c.VelY) < 1e-4 {
		c.VelY = 0
	}
	if math.Abs(c.AngularVel) < 1e-4 {
		c.AngularVel = 0
	}
}

// CheckAndSetSleepingState implements "Sleeping Islands" (Phase 4):
// If velocity and angular velocity are below threshold, sleep body to conserve CPU.
func CheckAndSetSleepingState(c *Creature) {
	cfg := GetGlobalConfig()
	threshold := cfg.Physics.SleepVelocityThreshold
	if threshold <= 0 {
		threshold = 0.05
	}

	speed := math.Hypot(c.VelX, c.VelY)
	angSpeed := math.Abs(c.AngularVel)

	if speed < threshold && angSpeed < threshold*10.0 && c.Forces.ActiveMusclesCount == 0 && (c.State != "dashing" || c.FoodEaten <= 0) {
		c.IsSleeping = true
		c.VelX = 0
		c.VelY = 0
		c.AngularVel = 0
	} else {
		c.IsSleeping = false
	}
}

// CalculateTimeOfImpact calculates Time of Impact (ToI) in [0, 1] between two moving bounding spheres (Phase 4 CCD)
func CalculateTimeOfImpact(pA Point, vA Point, rA float64, pB Point, vB Point, rB float64) (float64, bool) {
	// Relative position & velocity: dp = pB - pA, dv = vB - vA
	dpx := pB.X - pA.X
	dpy := pB.Y - pA.Y
	dvx := vB.X - vA.X
	dvy := vB.Y - vA.Y

	rTotal := rA + rB
	distSq := dpx*dpx + dpy*dpy

	if distSq <= rTotal*rTotal {
		// Already overlapping
		return 0.0, true
	}

	// Solve quadratic: |dp + dv * t|^2 = rTotal^2
	// (dv.dv)*t^2 + 2*(dp.dv)*t + (dp.dp - rTotal^2) = 0
	a := dvx*dvx + dvy*dvy
	if a < 1e-6 {
		// No relative motion
		return 1.0, false
	}

	b := 2.0 * (dpx*dvx + dpy*dvy)
	c := distSq - (rTotal * rTotal)

	discriminant := b*b - 4.0*a*c
	if discriminant < 0 {
		// No collision trajectory
		return 1.0, false
	}

	sqrtD := math.Sqrt(discriminant)
	t1 := (-b - sqrtD) / (2.0 * a)

	if t1 >= 0.0 && t1 <= 1.0 {
		return t1, true
	}
	return 1.0, false
}

// ResolveCreatureCollisions implements Newtonian 2D collision physics with:
// - Sleeping islands optimization (Phase 4)
// - Adaptive Continuous Collision Detection (CCD) for dashing / fast creatures (Phase 4)
// - Huygens-Steiner Inertia Tensor & Center of Mass (Phase 1)
// - Dynamic Restitution & Tangential Friction with Spin Effect (Phase 2 & 5)
func ResolveCreatureCollisions(creatures map[string]*Creature) {
	if len(creatures) < 2 {
		return
	}

	cfg := GetGlobalConfig()
	const touchDist = 1.0
	restitution := cfg.Physics.RestitutionCoefficient
	const frictionCoef = 0.35 // Tangential friction coefficient for glancing hits

	list := make([]*Creature, 0, len(creatures))
	for _, c := range creatures {
		list = append(list, c)
	}

	worldRadius := cfg.World.WorldBoundsX / 2.0
	if worldRadius <= 0 {
		worldRadius = 50.0
	}

	for i := 0; i < len(list); i++ {
		for j := i + 1; j < len(list); j++ {
			cA := list[i]
			cB := list[j]

			// Safe Zone Base Check: Creatures inside base do not push or collide with each other
			inBaseA := cA.InBase || IsInsideBase(cA.X, cA.Y, worldRadius)
			inBaseB := cB.InBase || IsInsideBase(cB.X, cB.Y, worldRadius)
			if inBaseA || inBaseB {
				continue
			}

			// Phase 4: Sleeping Island Check - Skip if both are sleeping and not moving
			if cA.IsSleeping && cB.IsSleeping {
				continue
			}

			// 1. Broad-phase bounding sphere check
			rA := CalculateCreatureRadius(cA.Elements)
			rB := CalculateCreatureRadius(cB.Elements)
			centerDist := math.Hypot(cB.X-cA.X, cB.Y-cA.Y)

			// Phase 4: Adaptive CCD for Dashing / High-speed creatures
			isFast := cA.State == "dashing" || cB.State == "dashing" || math.Hypot(cA.VelX, cA.VelY) > 0.3 || math.Hypot(cB.VelX, cB.VelY) > 0.3
			if isFast {
				toi, hasHit := CalculateTimeOfImpact(
					Point{X: cA.X, Y: cA.Y}, Point{X: cA.VelX, Y: cA.VelY}, rA,
					Point{X: cB.X, Y: cB.Y}, Point{X: cB.VelX, Y: cB.VelY}, rB,
				)
				if hasHit && toi < 1.0 {
					// Advance positions to impact time
					cA.X += cA.VelX * toi
					cA.Y += cA.VelY * toi
					cB.X += cB.VelX * toi
					cB.Y += cB.VelY * toi
					cA.IsSleeping = false
					cB.IsSleeping = false
				}
			}

			if centerDist >= rA+rB+1.0 {
				continue
			}

			// 2. Narrow-phase: element-level contact point search
			ptsA := GetCreatureElementWorldPositions(cA.X, cA.Y, cA.AngleDeg, cA.Elements)
			ptsB := GetCreatureElementWorldPositions(cB.X, cB.Y, cB.AngleDeg, cB.Elements)

			minElDist := math.Inf(1)
			var contactPtA, contactPtB Point

			for pa := 0; pa < len(ptsA); pa++ {
				for pb := 0; pb < len(ptsB); pb++ {
					edist := math.Hypot(ptsB[pb].X-ptsA[pa].X, ptsB[pb].Y-ptsA[pa].Y)
					if edist < minElDist {
						minElDist = edist
						contactPtA = ptsA[pa]
						contactPtB = ptsB[pb]
					}
				}
			}

			if minElDist >= touchDist {
				continue
			}

			// Wake up both creatures upon collision
			cA.IsSleeping = false
			cB.IsSleeping = false

			// 3. Normal vector from contact point A to contact point B
			nx := contactPtB.X - contactPtA.X
			ny := contactPtB.Y - contactPtA.Y
			nlen := math.Hypot(nx, ny)

			if nlen < 0.0001 {
				nx = cB.X - cA.X
				ny = cB.Y - cA.Y
				nlen = math.Hypot(nx, ny)
				if nlen < 0.0001 {
					nx = 1
					ny = 0
					nlen = 1
				}
			}
			nx /= nlen
			ny /= nlen

			mA := math.Max(0.5, cA.Forces.TotalMass)
			mB := math.Max(0.5, cB.Forces.TotalMass)
			iA := math.Max(0.2, cA.Forces.TotalInertia)
			iB := math.Max(0.2, cB.Forces.TotalInertia)

			// 4. Positional anti-overlap separation (mass weighted)
			overlap := touchDist - minElDist
			if overlap > 0 {
				pushA := overlap * (mB / (mA + mB))
				pushB := overlap * (mA / (mA + mB))
				cA.X -= nx * pushA
				cA.Y -= ny * pushA
				cB.X += nx * pushB
				cB.Y += ny * pushB
			}

			// 5. Contact point position vectors relative to Center of Mass
			rxA := contactPtA.X - (cA.X + cA.Forces.CenterOfMassX)
			ryA := contactPtA.Y - (cA.Y + cA.Forces.CenterOfMassY)
			rxB := contactPtB.X - (cB.X + cB.Forces.CenterOfMassX)
			ryB := contactPtB.Y - (cB.Y + cB.Forces.CenterOfMassY)

			// 6. Linear velocities at centers of mass
			dashMul := cfg.Physics.DashMultiplier
			speedA := cA.Forces.ForwardSpeed * 0.35
			if cA.State == "dashing" && cA.FoodEaten > 0 {
				speedA *= dashMul
			}
			speedB := cB.Forces.ForwardSpeed * 0.35
			if cB.State == "dashing" && cB.FoodEaten > 0 {
				speedB *= dashMul
			}

			radA := (cA.AngleDeg * math.Pi) / 180.0
			radB := (cB.AngleDeg * math.Pi) / 180.0

			vAx := cA.VelX + speedA*math.Cos(radA)
			vAy := cA.VelY + speedA*math.Sin(radA)
			vBx := cB.VelX + speedB*math.Cos(radB)
			vBy := cB.VelY + speedB*math.Sin(radB)

			// Projection of relative velocity onto contact normal
			vAn := vAx*nx + vAy*ny
			vBn := vBx*nx + vBy*ny
			vRelN := vAn - vBn

			// 7. Impulse calculation only when creatures are approaching
			if vRelN > 0 {
				// 2D angular cross product components (r x n)
				rnA := rxA*ny - ryA*nx
				rnB := rxB*ny - ryB*nx

				// Effective inverse mass along normal including Huygens-Steiner rotational inertia
				kn := (1.0 / mA) + (1.0 / mB) + (rnA*rnA)/iA + (rnB*rnB)/iB

				impulseN := ((1.0 + restitution) * vRelN) / kn

				// Tangential friction vector (Phase 2: Spin and glancing hits)
				tx := -ny
				ty := nx
				vAt := vAx*tx + vAy*ty
				vBt := vBx*tx + vBy*ty
				vRelT := vAt - vBt

				rtA := rxA*ty - ryA*tx
				rtB := rxB*ty - ryB*tx
				kt := (1.0 / mA) + (1.0 / mB) + (rtA*rtA)/iA + (rtB*rtB)/iB

				maxFriction := frictionCoef * impulseN
				impulseT := math.Max(-maxFriction, math.Min(maxFriction, vRelT/kt))

				// Total impulse vectors acting on A and B
				jAx := -(impulseN*nx + impulseT*tx)
				jAy := -(impulseN*ny + impulseT*ty)
				jBx := +(impulseN*nx + impulseT*tx)
				jBy := +(impulseN*ny + impulseT*ty)

				// Recoil linear displacement
				recoilFactor := 0.45
				cA.X += (jAx / mA) * recoilFactor
				cA.Y += (jAy / mA) * recoilFactor
				cB.X += (jBx / mB) * recoilFactor
				cB.Y += (jBy / mB) * recoilFactor

				cA.VelX += jAx / mA
				cA.VelY += jAy / mA
				cB.VelX += jBx / mB
				cB.VelY += jBy / mB

				// Rotational Torque: tau = r x J = rx * Jy - ry * Jx
				torqueA := rxA*jAy - ryA*jAx
				torqueB := rxB*jBy - ryB*jBx

				// Angular velocity step and spin effect: delta omega = (tau / I)
				dOmegaA := (torqueA / iA) * (180.0 / math.Pi) * 1.25
				dOmegaB := (torqueB / iB) * (180.0 / math.Pi) * 1.25

				cA.AngularVel += dOmegaA * 0.1
				cB.AngularVel += dOmegaB * 0.1

				clampedDA := math.Max(-30.0, math.Min(30.0, dOmegaA))
				clampedDB := math.Max(-30.0, math.Min(30.0, dOmegaB))

				cA.AngleDeg = math.Mod(cA.AngleDeg+clampedDA+360.0, 360.0)
				cB.AngleDeg = math.Mod(cB.AngleDeg+clampedDB+360.0, 360.0)
				cA.TargetAngleDeg = cA.AngleDeg
				cB.TargetAngleDeg = cB.AngleDeg
			}
		}
	}
}

func GetVectorFromAngle(angleDeg float64) (float64, float64) {
	rad := (angleDeg * math.Pi) / 180.0
	return math.Cos(rad), math.Sin(rad)
}

func CalculateCreatureRadius(elements []CreatureElement) float64 {
	maxR := 0.5
	for _, el := range elements {
		r := math.Hypot(el.RelX, el.RelY) + 0.5
		if r > maxR {
			maxR = r
		}
	}
	return maxR
}

func PointToSegmentDistanceSq(px, py, ax, ay, bx, by float64) float64 {
	dpx := px - ax
	if dpx > 50.0 {
		dpx -= 100.0
	} else if dpx < -50.0 {
		dpx += 100.0
	}
	dpy := py - ay
	if dpy > 50.0 {
		dpy -= 100.0
	} else if dpy < -50.0 {
		dpy += 100.0
	}

	dbx := bx - ax
	if dbx > 50.0 {
		dbx -= 100.0
	} else if dbx < -50.0 {
		dbx += 100.0
	}
	dby := by - ay
	if dby > 50.0 {
		dby -= 100.0
	} else if dby < -50.0 {
		dby += 100.0
	}

	if dbx == 0 && dby == 0 {
		return dpx*dpx + dpy*dpy
	}
	l2 := dbx*dbx + dby*dby
	t := math.Max(0, math.Min(1, (dpx*dbx+dpy*dby)/l2))
	projX := t * dbx
	projY := t * dby
	return (dpx-projX)*(dpx-projX) + (dpy-projY)*(dpy-projY)
}

func GetCreatureElementWorldPositions(cx, cy, angleDeg float64, elements []CreatureElement) []Point {
	baseHeadAngle := DetermineCreatureHeadAngle(elements)
	rotRad := ((angleDeg - baseHeadAngle) * math.Pi) / 180.0
	cos := math.Cos(rotRad)
	sin := math.Sin(rotRad)

	points := []Point{{X: cx, Y: cy}}
	for _, el := range elements {
		wx := cx + el.RelX*cos - el.RelY*sin
		wy := cy + el.RelX*sin + el.RelY*cos
		points = append(points, Point{X: wx, Y: wy})
	}
	return points
}

func FindEatenFood(prevX, prevY, prevAngleDeg, nextX, nextY, nextAngleDeg float64, elements []CreatureElement, foods []Food) *Food {
	if len(foods) == 0 {
		return nil
	}
	maxRadiusSq := 0.7 * 0.7

	startPts := GetCreatureElementWorldPositions(prevX, prevY, prevAngleDeg, elements)
	endPts := GetCreatureElementWorldPositions(nextX, nextY, nextAngleDeg, elements)

	for i := range foods {
		f := &foods[i]
		if PointToSegmentDistanceSq(f.X, f.Y, prevX, prevY, nextX, nextY) <= maxRadiusSq {
			return f
		}
		for p := range endPts {
			sp := Point{X: prevX, Y: prevY}
			if p < len(startPts) {
				sp = startPts[p]
			}
			ep := endPts[p]
			if PointToSegmentDistanceSq(f.X, f.Y, sp.X, sp.Y, ep.X, ep.Y) <= maxRadiusSq {
				return f
			}
		}
	}
	return nil
}

// FindConnectedComponents divides elements into connected graph components (grid adjacency max(|dx|,|dy|) <= 1)
func FindConnectedComponents(elements []CreatureElement) [][]CreatureElement {
	n := len(elements)
	if n == 0 {
		return nil
	}

	visited := make([]bool, n)
	var components [][]CreatureElement

	for i := 0; i < n; i++ {
		if visited[i] {
			continue
		}
		var comp []CreatureElement
		queue := []int{i}
		visited[i] = true

		for len(queue) > 0 {
			currIdx := queue[0]
			queue = queue[1:]
			currEl := elements[currIdx]
			comp = append(comp, currEl)

			for j := 0; j < n; j++ {
				if visited[j] {
					continue
				}
				otherEl := elements[j]
				dx := math.Abs(currEl.RelX - otherEl.RelX)
				dy := math.Abs(currEl.RelY - otherEl.RelY)
				if dx <= 1.05 && dy <= 1.05 {
					visited[j] = true
					queue = append(queue, j)
				}
			}
		}
		components = append(components, comp)
	}

	return components
}

// SelectWinningComponent picks the component with most heads > greatest mass > random choice
func SelectWinningComponent(components [][]CreatureElement) []CreatureElement {
	if len(components) == 0 {
		return nil
	}
	if len(components) == 1 {
		return components[0]
	}

	type compStats struct {
		elements  []CreatureElement
		headCount int
		totalMass float64
	}

	stats := make([]compStats, len(components))
	maxHeads := -1

	for i, comp := range components {
		heads := 0
		mass := 0.0
		for _, el := range comp {
			m := GetElementMass(el.Type, el.Weight)
			if el.Type == ElementHead || el.Type == ElementHeadJaw {
				heads++
			}
			mass += m
		}
		stats[i] = compStats{
			elements:  comp,
			headCount: heads,
			totalMass: mass,
		}
		if heads > maxHeads {
			maxHeads = heads
		}
	}

	var headCandidates []compStats
	for _, s := range stats {
		if s.headCount == maxHeads {
			headCandidates = append(headCandidates, s)
		}
	}

	if len(headCandidates) == 1 {
		return headCandidates[0].elements
	}

	maxMass := -1.0
	for _, c := range headCandidates {
		if c.totalMass > maxMass {
			maxMass = c.totalMass
		}
	}

	var massCandidates []compStats
	for _, c := range headCandidates {
		if math.Abs(c.totalMass-maxMass) < 1e-4 {
			massCandidates = append(massCandidates, c)
		}
	}

	if len(massCandidates) == 1 {
		return massCandidates[0].elements
	}

	rndIdx := rand.Intn(len(massCandidates))
	return massCandidates[rndIdx].elements
}

// ResolveCreatureBites handles biting when a combat jaw head touches another creature's element
func ResolveCreatureBites(creatures map[string]*Creature, spawnFoodCb func(x, y float64, fType FoodType)) {
	if len(creatures) < 2 {
		return
	}

	cfg := GetGlobalConfig()
	if !cfg.World.EnableCannibalism {
		return
	}

	worldRadius := cfg.World.WorldBoundsX / 2.0
	if worldRadius <= 0 {
		worldRadius = 50.0
	}

	list := make([]*Creature, 0, len(creatures))
	for _, c := range creatures {
		list = append(list, c)
	}

	const biteTouchDist = 1.25

	type biteEvent struct {
		biterID       string
		targetID      string
		targetElemIdx int
		contactX      float64
		contactY      float64
	}

	var biteEvents []biteEvent

	for i := 0; i < len(list); i++ {
		cA := list[i]
		// Safe Zone check: No attacks if biter is inside base
		if IsInsideBase(cA.X, cA.Y, worldRadius) {
			continue
		}

		type activeJaw struct {
			point          Point
			worldGazeAngle float64
		}
		var activeJaws []activeJaw

		ptsA := GetCreatureElementWorldPositions(cA.X, cA.Y, cA.AngleDeg, cA.Elements)

		// Find heads coordinates
		headCoords := make(map[string]CreatureElement)
		for _, el := range cA.Elements {
			if el.Type == ElementHead {
				headCoords[fmt.Sprintf("%d,%d", el.RelX, el.RelY)] = el
			}
		}

		baseHeadAngle := DetermineCreatureHeadAngle(cA.Elements)
		deltaRot := cA.AngleDeg - baseHeadAngle

		// Rule: Cannibalism is only possible if creature has a jaw (ElementHeadJaw) attached to a head
		for idx, el := range cA.Elements {
			if el.Type == ElementHeadJaw {
				coordKey := fmt.Sprintf("%d,%d", el.RelX, el.RelY)
				parentHead, hasHead := headCoords[coordKey]
				if hasHead || el.HeadAngle != nil {
					if idx+1 < len(ptsA) {
						jawPos := ptsA[idx+1]
						hAngle := baseHeadAngle
						if el.HeadAngle != nil {
							hAngle = *el.HeadAngle
						} else if hasHead && parentHead.HeadAngle != nil {
							hAngle = *parentHead.HeadAngle
						}
						worldGaze := hAngle + deltaRot
						activeJaws = append(activeJaws, activeJaw{
							point:          jawPos,
							worldGazeAngle: worldGaze,
						})
					}
				}
			}
		}

		if len(activeJaws) == 0 {
			continue
		}

		for j := 0; j < len(list); j++ {
			if i == j {
				continue
			}
			cB := list[j]

			// Safe Zone check: Target is immune inside base
			if IsInsideBase(cB.X, cB.Y, worldRadius) {
				continue
			}

			rA := CalculateCreatureRadius(cA.Elements)
			rB := CalculateCreatureRadius(cB.Elements)
			if math.Hypot(cB.X-cA.X, cB.Y-cA.Y) > rA+rB+2.0 {
				continue
			}

			ptsB := GetCreatureElementWorldPositions(cB.X, cB.Y, cB.AngleDeg, cB.Elements)

			bitten := false
			for _, jaw := range activeJaws {
				if bitten {
					break
				}
				for elIdx := range cB.Elements {
					if elIdx+1 >= len(ptsB) {
						continue
					}
					bPt := ptsB[elIdx+1]

					dx := bPt.X - jaw.point.X
					if dx > 50.0 {
						dx -= 100.0
					} else if dx < -50.0 {
						dx += 100.0
					}
					dy := bPt.Y - jaw.point.Y
					if dy > 50.0 {
						dy -= 100.0
					} else if dy < -50.0 {
						dy += 100.0
					}

					dist := math.Hypot(dx, dy)
					if dist <= biteTouchDist {
						// Rule: Jaw captures a 60-degree sector (±30°) in the head's gaze direction
						targetAngle := (math.Atan2(dy, dx) * 180.0) / math.Pi
						angleDiff := math.Abs(NormalizeAngleDeg(targetAngle - jaw.worldGazeAngle))

						if angleDiff <= 30.0 {
							biteEvents = append(biteEvents, biteEvent{
								biterID:       cA.ID,
								targetID:      cB.ID,
								targetElemIdx: elIdx,
								contactX:      bPt.X,
								contactY:      bPt.Y,
							})
							bitten = true
							break
						}
					}
				}
			}
		}
	}

	for _, bEvent := range biteEvents {
		cA, existsA := creatures[bEvent.biterID]
		cB, existsB := creatures[bEvent.targetID]
		if !existsA || !existsB {
			continue
		}
		if bEvent.targetElemIdx >= len(cB.Elements) {
			continue
		}

		targetEl := cB.Elements[bEvent.targetElemIdx]
		removeIdx := -1

		if targetEl.Type == ElementJoint {
			muscleIdx := -1
			for mIdx, el := range cB.Elements {
				if strings.HasPrefix(string(el.Type), "muscle-") {
					dx := math.Abs(el.RelX - targetEl.RelX)
					dy := math.Abs(el.RelY - targetEl.RelY)
					if dx <= 1.05 && dy <= 1.05 {
						muscleIdx = mIdx
						break
					}
				}
			}
			if muscleIdx != -1 {
				removeIdx = muscleIdx
			} else {
				removeIdx = bEvent.targetElemIdx
			}
		} else {
			removeIdx = bEvent.targetElemIdx
		}

		if removeIdx >= 0 && removeIdx < len(cB.Elements) {
			bittenEl := cB.Elements[removeIdx]
			remainingEls := make([]CreatureElement, 0, len(cB.Elements)-1)
			remainingEls = append(remainingEls, cB.Elements[:removeIdx]...)
			remainingEls = append(remainingEls, cB.Elements[removeIdx+1:]...)

			comps := FindConnectedComponents(remainingEls)
			winningComp := SelectWinningComponent(comps)

			cB.Elements = winningComp

			// Bio-Nuggets drop mechanics:
			// 60% of bitten piece value drops as Golden/Super Bio-Nuggets
			// 20% drops as regular berry food
			// 20% burns
			elemCost := GetElementCost(bittenEl.Type)
			bioCount := int(math.Max(1.0, math.Round(float64(elemCost)*0.60/15.0)))
			regCount := int(math.Max(1.0, math.Round(float64(elemCost)*0.20/5.0)))

			if spawnFoodCb != nil {
				for b := 0; b < bioCount; b++ {
					fx := bEvent.contactX + (rand.Float64()-0.5)*1.5
					fy := bEvent.contactY + (rand.Float64()-0.5)*1.5
					fType := FoodGolden
					if b%2 == 1 {
						fType = FoodSuper
					}
					spawnFoodCb(fx, fy, fType)
				}
				for r := 0; r < regCount; r++ {
					fx := bEvent.contactX + (rand.Float64()-0.5)*2.0
					fy := bEvent.contactY + (rand.Float64()-0.5)*2.0
					spawnFoodCb(fx, fy, FoodBerry)
				}
			}

			if len(cB.Elements) == 0 {
				// Target creature destroyed completely
				if cB.FoodEaten > 0 && spawnFoodCb != nil {
					dropBio := int(math.Max(1.0, float64(cB.FoodEaten)*0.60/10.0))
					for db := 0; db < dropBio; db++ {
						fx := cB.X + (rand.Float64()-0.5)*2.0
						fy := cB.Y + (rand.Float64()-0.5)*2.0
						spawnFoodCb(fx, fy, FoodGolden)
					}
				}
				delete(creatures, cB.ID)
				cA.FoodEaten += 10
				cA.Score += 100
				cA.Kills++
				cA.Energy = math.Min(cA.MaxEnergy, cA.Energy+50.0)
			} else {
				cB.Forces = CalculatePhysicsForces(cB.Elements, cB.MuscleStep)
				cA.FoodEaten += 2
				cA.Score += 25
				cA.Energy = math.Min(cA.MaxEnergy, cA.Energy+15.0)
			}
		}
	}
}
