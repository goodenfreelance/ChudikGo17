package game

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type WorldRules struct {
	WorldBoundsX      float64 `json:"worldBoundsX"`
	WorldBoundsY      float64 `json:"worldBoundsY"`
	TickRate          int     `json:"tickRate"`
	EnableCannibalism bool    `json:"enableCannibalism"`
	UnlimitedElements bool    `json:"unlimitedElements"`
}

type PhysicsRules struct {
	RestitutionCoefficient float64 `json:"restitutionCoefficient"`
	DashMultiplier         float64 `json:"dashMultiplier"`
	DashFoodCostPerSecond  float64 `json:"dashFoodCostPerSecond"`
	MaxSpeed               float64 `json:"maxSpeed"`
	DragLinear             float64 `json:"dragLinear"`
	DragAngular            float64 `json:"dragAngular"`
	MuscleStiffness        float64 `json:"muscleStiffness"`
	MuscleDamping          float64 `json:"muscleDamping"`
	SleepVelocityThreshold float64 `json:"sleepVelocityThreshold"`
}

type ElementMasses struct {
	MassHead   float64 `json:"massHead"`
	MassBone   float64 `json:"massBone"`
	MassJoint  float64 `json:"massJoint"`
	MassMuscle float64 `json:"massMuscle"`
	MassEye    float64 `json:"massEye"`
	MassMouth  float64 `json:"massMouth"`
}

type EconomyRules struct {
	StarterBankFood int            `json:"starterBankFood"`
	FoodBerryValue  int            `json:"foodBerryValue"`
	FoodGoldenValue int            `json:"foodGoldenValue"`
	ElementPrices   map[string]int `json:"elementPrices"`
}

type WorldConfig struct {
	World         WorldRules    `json:"world"`
	Physics       PhysicsRules  `json:"physics"`
	ElementMasses ElementMasses `json:"elementMasses"`
	Economy       EconomyRules  `json:"economy"`
}

var (
	globalConfigMu sync.RWMutex
	globalConfig   WorldConfig
	configPath     string
	lastModTime    time.Time
	onConfigChange []func(WorldConfig)
)

func init() {
	// Initialize default configuration
	globalConfig = DefaultWorldConfig()
}

func DefaultWorldConfig() WorldConfig {
	return WorldConfig{
		World: WorldRules{
			WorldBoundsX:      100.0,
			WorldBoundsY:      100.0,
			TickRate:          60, // 60 FPS physics tick
			EnableCannibalism: true,
			UnlimitedElements: false,
		},
		Physics: PhysicsRules{
			RestitutionCoefficient: 0.45,
			DashMultiplier:         1.6,
			DashFoodCostPerSecond:  1.0,
			MaxSpeed:               1.2,
			DragLinear:             3.0,
			DragAngular:            4.5,
			MuscleStiffness:        40.0,
			MuscleDamping:          5.0,
			SleepVelocityThreshold: 0.05,
		},
		ElementMasses: ElementMasses{
			MassHead:   1.0,
			MassBone:   1.0,
			MassJoint:  0.0,
			MassMuscle: 0.0,
			MassEye:    0.2,
			MassMouth:  0.5,
		},
		Economy: EconomyRules{
			StarterBankFood: 100,
			FoodBerryValue:  1,
			FoodGoldenValue: 5,
			ElementPrices: map[string]int{
				"head-jaw":           180,
				"head":               50,
				"muscle-random-left":  35,
				"muscle-random-right": 35,
				"muscle-left":         25,
				"muscle-right":        25,
				"joint":               10,
				"edge-h":              10,
				"edge-v":              10,
				"edge-d1":             10,
				"edge-d2":             10,
				"eye":                 10,
				"mouth":               10,
			},
		},
	}
}

// GetGlobalConfig returns a copy of the current configuration (thread-safe)
func GetGlobalConfig() WorldConfig {
	globalConfigMu.RLock()
	defer globalConfigMu.RUnlock()
	return globalConfig
}

// RegisterConfigChangeListener registers a callback fired when config updates
func RegisterConfigChangeListener(cb func(WorldConfig)) {
	globalConfigMu.Lock()
	defer globalConfigMu.Unlock()
	onConfigChange = append(onConfigChange, cb)
}

// GetElementMass returns mass for a given element type based on active world rules
func GetElementMass(elType ElementType, customWeight float64) float64 {
	cfg := GetGlobalConfig()
	switch elType {
	case ElementHead, ElementHeadJaw:
		return cfg.ElementMasses.MassHead
	case ElementJoint:
		return cfg.ElementMasses.MassJoint
	case "eye":
		return cfg.ElementMasses.MassEye
	case "mouth":
		return cfg.ElementMasses.MassMouth
	default:
		if strings.HasPrefix(string(elType), "edge-") {
			if customWeight > 0 {
				return customWeight * cfg.ElementMasses.MassBone
			}
			return cfg.ElementMasses.MassBone
		}
		if strings.HasPrefix(string(elType), "muscle-") {
			return cfg.ElementMasses.MassMuscle
		}
	}
	if customWeight > 0 {
		return customWeight
	}
	return 1.0
}

// InitConfigLoader initializes config file path, loads it, and starts periodic hot-reload watcher
func InitConfigLoader(preferredPath string) {
	candidates := []string{
		preferredPath,
		"world_rules.json",
		"../world_rules.json",
		filepath.Join(os.Getenv("PWD"), "world_rules.json"),
	}

	foundPath := ""
	for _, p := range candidates {
		if p == "" {
			continue
		}
		if fi, err := os.Stat(p); err == nil && !fi.IsDir() {
			foundPath = p
			break
		}
	}

	if foundPath == "" {
		foundPath = "world_rules.json"
		// Save default if not exists
		SaveConfigFile(foundPath, DefaultWorldConfig())
	}

	configPath = foundPath
	LoadConfigFile(configPath)

	// Background hot-reload watcher checking file modification every 1 second
	go func() {
		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			if configPath == "" {
				continue
			}
			fi, err := os.Stat(configPath)
			if err != nil {
				continue
			}
			if fi.ModTime().After(lastModTime) {
				log.Printf("🔄 [HOT-RELOAD] Detected change in %s. Reloading world rules...", configPath)
				LoadConfigFile(configPath)
			}
		}
	}()
}

// LoadConfigFile loads config from file path
func LoadConfigFile(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		log.Printf("⚠️ [CONFIG] Could not read %s: %v. Using defaults.", path, err)
		return err
	}

	var newCfg WorldConfig
	if err := json.Unmarshal(data, &newCfg); err != nil {
		log.Printf("⚠️ [CONFIG] JSON syntax error in %s: %v", path, err)
		return err
	}

	// Validate bounds and non-zero values
	validateConfig(&newCfg)

	globalConfigMu.Lock()
	globalConfig = newCfg
	fi, _ := os.Stat(path)
	if fi != nil {
		lastModTime = fi.ModTime()
	}
	listeners := make([]func(WorldConfig), len(onConfigChange))
	copy(listeners, onConfigChange)
	globalConfigMu.Unlock()

	log.Printf("✅ [CONFIG] Loaded World Rules: TickRate=%d, Cannibalism=%v, Restitution=%.2f, Stiffness=%.1f, Damping=%.1f",
		newCfg.World.TickRate, newCfg.World.EnableCannibalism, newCfg.Physics.RestitutionCoefficient,
		newCfg.Physics.MuscleStiffness, newCfg.Physics.MuscleDamping)

	// Trigger callbacks
	for _, cb := range listeners {
		cb(newCfg)
	}
	return nil
}

// SaveConfigFile writes config to disk and updates in-memory config
func SaveConfigFile(path string, cfg WorldConfig) error {
	validateConfig(&cfg)
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(path, data, 0644); err != nil {
		return err
	}

	globalConfigMu.Lock()
	globalConfig = cfg
	if fi, err := os.Stat(path); err == nil {
		lastModTime = fi.ModTime()
	}
	listeners := make([]func(WorldConfig), len(onConfigChange))
	copy(listeners, onConfigChange)
	globalConfigMu.Unlock()

	for _, cb := range listeners {
		cb(cfg)
	}
	return nil
}

// UpdateConfigInPlace updates the configuration programmatically (e.g. from Admin API)
func UpdateConfigInPlace(cfg WorldConfig) error {
	if configPath == "" {
		configPath = "world_rules.json"
	}
	return SaveConfigFile(configPath, cfg)
}

func validateConfig(cfg *WorldConfig) {
	if cfg.World.WorldBoundsX <= 0 {
		cfg.World.WorldBoundsX = 2000.0
	}
	if cfg.World.WorldBoundsY <= 0 {
		cfg.World.WorldBoundsY = 2000.0
	}
	if cfg.World.TickRate < 10 {
		cfg.World.TickRate = 10
	} else if cfg.World.TickRate > 200 {
		cfg.World.TickRate = 200
	}
	if cfg.Physics.RestitutionCoefficient < 0 {
		cfg.Physics.RestitutionCoefficient = 0.0
	} else if cfg.Physics.RestitutionCoefficient > 1.0 {
		cfg.Physics.RestitutionCoefficient = 1.0
	}
	if cfg.Physics.DashMultiplier <= 0 {
		cfg.Physics.DashMultiplier = 1.6
	}
	if cfg.Physics.DashFoodCostPerSecond < 0 {
		cfg.Physics.DashFoodCostPerSecond = 2.0
	}
	if cfg.Physics.DragLinear < 0 {
		cfg.Physics.DragLinear = 0.01
	}
	if cfg.Physics.DragAngular < 0 {
		cfg.Physics.DragAngular = 0.005
	}
	if cfg.Physics.MuscleStiffness <= 0 {
		cfg.Physics.MuscleStiffness = 50.0
	}
	if cfg.Physics.MuscleDamping < 0 {
		cfg.Physics.MuscleDamping = 5.0
	}
	if cfg.Physics.SleepVelocityThreshold <= 0 {
		cfg.Physics.SleepVelocityThreshold = 0.05
	}
	if cfg.ElementMasses.MassHead < 0 {
		cfg.ElementMasses.MassHead = 1.0
	}
	if cfg.ElementMasses.MassBone < 0 {
		cfg.ElementMasses.MassBone = 1.0
	}
	if cfg.ElementMasses.MassJoint < 0 {
		cfg.ElementMasses.MassJoint = 0.0
	}
	if cfg.ElementMasses.MassMuscle < 0 {
		cfg.ElementMasses.MassMuscle = 0.0
	}
	if cfg.ElementMasses.MassEye < 0 {
		cfg.ElementMasses.MassEye = 0.2
	}
	if cfg.ElementMasses.MassMouth < 0 {
		cfg.ElementMasses.MassMouth = 0.5
	}
	if cfg.Economy.FoodBerryValue <= 0 {
		cfg.Economy.FoodBerryValue = 1
	}
	if cfg.Economy.FoodGoldenValue <= 0 {
		cfg.Economy.FoodGoldenValue = 5
	}
	if cfg.Economy.StarterBankFood < 0 {
		cfg.Economy.StarterBankFood = 100
	}
	if cfg.Economy.ElementPrices == nil {
		cfg.Economy.ElementPrices = make(map[string]int)
	}
}
