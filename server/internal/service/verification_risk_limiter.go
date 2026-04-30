package service

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"home-decoration-server/internal/repository"
	"home-decoration-server/pkg/timeutil"

	"github.com/redis/go-redis/v9"
)

const (
	personVerificationUserDailyLimit = 5
	personVerificationIDDailyLimit   = 8
	personVerificationIPHourlyLimit  = 20
	personVerificationCooldown       = 10 * time.Minute

	enterpriseVerificationAppDailyLimit     = 5
	enterpriseVerificationLicenseDailyLimit = 10
	enterpriseVerificationIPHourlyLimit     = 30
	enterpriseVerificationCooldown          = 30 * time.Minute
	enterpriseVerificationSuccessTTL        = 30 * 24 * time.Hour
)

var errVerificationTooFrequent = errors.New("操作过于频繁，请稍后再试")

type verificationRiskLimiter struct {
	mu        sync.Mutex
	counts    map[string]int
	expiresAt map[string]time.Time
}

var verificationLimiter = newVerificationRiskLimiter()

func newVerificationRiskLimiter() *verificationRiskLimiter {
	return &verificationRiskLimiter{
		counts:    make(map[string]int),
		expiresAt: make(map[string]time.Time),
	}
}

func resetVerificationRiskLimiterForTest() {
	verificationLimiter = newVerificationRiskLimiter()
}

func hashVerificationValue(parts ...string) string {
	normalized := make([]string, 0, len(parts))
	for _, part := range parts {
		normalized = append(normalized, strings.ToUpper(strings.TrimSpace(part)))
	}
	sum := sha256.Sum256([]byte(strings.Join(normalized, "|")))
	return hex.EncodeToString(sum[:])
}

func verificationDaySuffix(now time.Time) string {
	return now.In(timeutil.Location()).Format("20060102")
}

func verificationHourSuffix(now time.Time) string {
	return now.UTC().Format("2006010215")
}

func verificationTTLUntilNextLocalDay(now time.Time) time.Duration {
	ttl := durationUntilNextLocalDay(now)
	if ttl <= 0 {
		return 24 * time.Hour
	}
	return ttl
}

func verificationRemainingError(ttl time.Duration) error {
	if ttl <= 0 {
		return errVerificationTooFrequent
	}
	seconds := int(ttl.Seconds())
	if seconds <= 0 {
		seconds = 1
	}
	return fmt.Errorf("操作过于频繁，请在 %d 秒后重试", seconds)
}

func (l *verificationRiskLimiter) checkCooldown(key string) error {
	if rdb := repository.GetRedis(); rdb != nil {
		ctx, cancel := repository.RedisContext()
		defer cancel()
		ttl, err := rdb.TTL(ctx, key).Result()
		if err == nil && ttl > 0 {
			return verificationRemainingError(ttl)
		}
		return nil
	}

	l.mu.Lock()
	defer l.mu.Unlock()
	if expiresAt, ok := l.expiresAt[key]; ok {
		if time.Now().Before(expiresAt) {
			return verificationRemainingError(time.Until(expiresAt))
		}
		delete(l.expiresAt, key)
	}
	return nil
}

func (l *verificationRiskLimiter) checkCount(key string, limit int) error {
	if strings.TrimSpace(key) == "" || limit <= 0 {
		return nil
	}
	if rdb := repository.GetRedis(); rdb != nil {
		ctx, cancel := repository.RedisContext()
		defer cancel()
		value, err := rdb.Get(ctx, key).Int()
		if err != nil && !errors.Is(err, redis.Nil) {
			return nil
		}
		if value >= limit {
			return errVerificationTooFrequent
		}
		return nil
	}

	l.mu.Lock()
	defer l.mu.Unlock()
	l.cleanupExpiredLocked(time.Now())
	if l.counts[key] >= limit {
		return errVerificationTooFrequent
	}
	return nil
}

func (l *verificationRiskLimiter) increment(key string, ttl time.Duration) {
	if strings.TrimSpace(key) == "" {
		return
	}
	if rdb := repository.GetRedis(); rdb != nil {
		ctx, cancel := repository.RedisContext()
		defer cancel()
		count, err := rdb.Incr(ctx, key).Result()
		if err == nil && count == 1 {
			_ = rdb.Expire(ctx, key, ttl).Err()
		}
		return
	}

	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	l.cleanupExpiredLocked(now)
	l.counts[key]++
	if ttl > 0 {
		l.expiresAt[key] = now.Add(ttl)
	}
}

func (l *verificationRiskLimiter) setCooldown(key string, ttl time.Duration) {
	if strings.TrimSpace(key) == "" || ttl <= 0 {
		return
	}
	if rdb := repository.GetRedis(); rdb != nil {
		ctx, cancel := repository.RedisContext()
		defer cancel()
		_ = rdb.Set(ctx, key, "1", ttl).Err()
		return
	}

	l.mu.Lock()
	defer l.mu.Unlock()
	l.expiresAt[key] = time.Now().Add(ttl)
}

func (l *verificationRiskLimiter) cleanupExpiredLocked(now time.Time) {
	for key, expiresAt := range l.expiresAt {
		if !expiresAt.After(now) {
			delete(l.expiresAt, key)
			delete(l.counts, key)
		}
	}
}

func personVerificationCooldownKey(userID uint64, inputHash string) string {
	return fmt.Sprintf("verification:person:cooldown:user:%d:input:%s", userID, inputHash)
}

func personVerificationUserDailyKey(userID uint64, now time.Time) string {
	return fmt.Sprintf("verification:person:count:user:%d:%s", userID, verificationDaySuffix(now))
}

func personVerificationIDDailyKey(idHash string, now time.Time) string {
	return fmt.Sprintf("verification:person:count:id:%s:%s", idHash, verificationDaySuffix(now))
}

func personVerificationIPHourlyKey(ip string, now time.Time) string {
	return fmt.Sprintf("verification:person:count:ip:%s:%s", strings.TrimSpace(ip), verificationHourSuffix(now))
}

func checkPersonVerificationRisk(userID uint64, idHash, inputHash, ip string) error {
	now := time.Now()
	if err := verificationLimiter.checkCooldown(personVerificationCooldownKey(userID, inputHash)); err != nil {
		return errors.New("请核对后稍后再试")
	}
	if err := verificationLimiter.checkCount(personVerificationUserDailyKey(userID, now), personVerificationUserDailyLimit); err != nil {
		return err
	}
	if err := verificationLimiter.checkCount(personVerificationIDDailyKey(idHash, now), personVerificationIDDailyLimit); err != nil {
		return err
	}
	if strings.TrimSpace(ip) != "" {
		if err := verificationLimiter.checkCount(personVerificationIPHourlyKey(ip, now), personVerificationIPHourlyLimit); err != nil {
			return err
		}
	}
	return nil
}

func recordPersonVerificationAttempt(userID uint64, idHash, inputHash, ip string, passed bool, providerUnavailable bool) {
	now := time.Now()
	dayTTL := verificationTTLUntilNextLocalDay(now)
	verificationLimiter.increment(personVerificationUserDailyKey(userID, now), dayTTL)
	verificationLimiter.increment(personVerificationIDDailyKey(idHash, now), dayTTL)
	if strings.TrimSpace(ip) != "" {
		verificationLimiter.increment(personVerificationIPHourlyKey(ip, now), time.Hour+time.Minute)
	}
	if !passed && !providerUnavailable {
		verificationLimiter.setCooldown(personVerificationCooldownKey(userID, inputHash), personVerificationCooldown)
	}
}

func enterpriseVerificationInputHash(companyName, licenseNo string) string {
	return hashVerificationValue(companyName, licenseNo)
}

func enterpriseVerificationSubject(applicationType string, applicationID uint64, actorKey string) string {
	applicationType = strings.TrimSpace(applicationType)
	if applicationID > 0 {
		return fmt.Sprintf("%s:%d", applicationType, applicationID)
	}
	actorKey = strings.TrimSpace(actorKey)
	if actorKey != "" {
		return fmt.Sprintf("%s:actor:%s", applicationType, hashVerificationValue(actorKey))
	}
	return applicationType + ":new"
}

func enterpriseVerificationCooldownKey(subject string, inputHash string) string {
	return fmt.Sprintf("verification:enterprise:cooldown:%s:%s", subject, inputHash)
}

func enterpriseVerificationAppDailyKey(subject string, now time.Time) string {
	return fmt.Sprintf("verification:enterprise:count:app:%s:%s", subject, verificationDaySuffix(now))
}

func enterpriseVerificationLicenseDailyKey(licenseHash string, now time.Time) string {
	return fmt.Sprintf("verification:enterprise:count:license:%s:%s", licenseHash, verificationDaySuffix(now))
}

func enterpriseVerificationIPHourlyKey(ip string, now time.Time) string {
	return fmt.Sprintf("verification:enterprise:count:ip:%s:%s", strings.TrimSpace(ip), verificationHourSuffix(now))
}

func enterpriseVerificationSuccessKey(inputHash string) string {
	return "verification:enterprise:success:" + inputHash
}

func checkEnterpriseVerificationRisk(applicationType string, applicationID uint64, actorKey, licenseHash, inputHash, ip string) error {
	now := time.Now()
	subject := enterpriseVerificationSubject(applicationType, applicationID, actorKey)
	if err := verificationLimiter.checkCooldown(enterpriseVerificationCooldownKey(subject, inputHash)); err != nil {
		return err
	}
	if err := verificationLimiter.checkCount(enterpriseVerificationAppDailyKey(subject, now), enterpriseVerificationAppDailyLimit); err != nil {
		return err
	}
	if err := verificationLimiter.checkCount(enterpriseVerificationLicenseDailyKey(licenseHash, now), enterpriseVerificationLicenseDailyLimit); err != nil {
		return err
	}
	if strings.TrimSpace(ip) != "" {
		if err := verificationLimiter.checkCount(enterpriseVerificationIPHourlyKey(ip, now), enterpriseVerificationIPHourlyLimit); err != nil {
			return err
		}
	}
	return nil
}

func recordEnterpriseVerificationAttempt(applicationType string, applicationID uint64, actorKey, licenseHash, inputHash, ip string, passed bool, providerUnavailable bool) {
	now := time.Now()
	dayTTL := verificationTTLUntilNextLocalDay(now)
	subject := enterpriseVerificationSubject(applicationType, applicationID, actorKey)
	verificationLimiter.increment(enterpriseVerificationAppDailyKey(subject, now), dayTTL)
	verificationLimiter.increment(enterpriseVerificationLicenseDailyKey(licenseHash, now), dayTTL)
	if strings.TrimSpace(ip) != "" {
		verificationLimiter.increment(enterpriseVerificationIPHourlyKey(ip, now), time.Hour+time.Minute)
	}
	if passed {
		verificationLimiter.setCooldown(enterpriseVerificationSuccessKey(inputHash), enterpriseVerificationSuccessTTL)
		return
	}
	if !providerUnavailable {
		verificationLimiter.setCooldown(enterpriseVerificationCooldownKey(subject, inputHash), enterpriseVerificationCooldown)
	}
}

func hasEnterpriseVerificationSuccess(inputHash string) bool {
	return verificationLimiter.checkCooldown(enterpriseVerificationSuccessKey(inputHash)) != nil
}
