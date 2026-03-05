package monitor

import (
	"fmt"
	"log"
	"sync"
	"time"
)

const duplicateLogInterval = 10 * time.Minute

// PublicIDHealthSnapshot represents in-memory counters for missing public ids.
type PublicIDHealthSnapshot struct {
	TotalMissing uint64            `json:"totalMissing"`
	ByScene      map[string]uint64 `json:"byScene"`
	UpdatedAt    time.Time         `json:"updatedAt"`
}

var publicIDHealthStore = struct {
	sync.Mutex
	totalMissing uint64
	byScene      map[string]uint64
	lastLoggedAt map[string]time.Time
	updatedAt    time.Time
	lastCleanup  time.Time
}{
	byScene:      make(map[string]uint64),
	lastLoggedAt: make(map[string]time.Time),
	updatedAt:    time.Now(),
	lastCleanup:  time.Now(),
}

// RecordPublicIDMissing records a missing publicId event for operational monitoring.
func RecordPublicIDMissing(scene string, userID uint64, detail string) {
	if scene == "" {
		scene = "unknown"
	}

	now := time.Now()
	key := fmt.Sprintf("%s:%s:%d", scene, detail, userID)

	publicIDHealthStore.Lock()
	publicIDHealthStore.totalMissing++
	publicIDHealthStore.byScene[scene]++
	publicIDHealthStore.updatedAt = now

	if now.Sub(publicIDHealthStore.lastCleanup) >= duplicateLogInterval {
		for k, t := range publicIDHealthStore.lastLoggedAt {
			if now.Sub(t) >= duplicateLogInterval {
				delete(publicIDHealthStore.lastLoggedAt, k)
			}
		}
		publicIDHealthStore.lastCleanup = now
	}

	shouldLog := true
	if t, ok := publicIDHealthStore.lastLoggedAt[key]; ok && now.Sub(t) < duplicateLogInterval {
		shouldLog = false
	}
	if shouldLog {
		publicIDHealthStore.lastLoggedAt[key] = now
	}
	publicIDHealthStore.Unlock()

	if shouldLog {
		log.Printf("[PublicIDMissing] scene=%s userId=%d detail=%s", scene, userID, detail)
	}
}

// SnapshotPublicIDHealth returns a copy of the current missing public id counters.
func SnapshotPublicIDHealth() PublicIDHealthSnapshot {
	publicIDHealthStore.Lock()
	defer publicIDHealthStore.Unlock()

	byScene := make(map[string]uint64, len(publicIDHealthStore.byScene))
	for scene, count := range publicIDHealthStore.byScene {
		byScene[scene] = count
	}

	return PublicIDHealthSnapshot{
		TotalMissing: publicIDHealthStore.totalMissing,
		ByScene:      byScene,
		UpdatedAt:    publicIDHealthStore.updatedAt,
	}
}
