package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/repository"

	"github.com/redis/go-redis/v9"
)

const (
	defaultSMSPhoneCooldown = 60 * time.Second
	defaultSMSRiskWindow    = 5 * time.Minute
	defaultSMSIPDailyLimit  = 20
	defaultSMSPhoneDaily    = 10

	smsPenaltyStage1 = 60 * time.Second
	smsPenaltyStage2 = 5 * time.Minute
	smsPenaltyStage3 = 30 * time.Minute
)

const (
	riskDimensionIP      = "ip"
	riskDimensionPhone   = "phone"
	riskDimensionCombo   = "combo"
	riskDimensionPurpose = "purpose"
)

// SMSRecord 短信发送记录
type SMSRecord struct {
	Phone      string
	SentAt     time.Time
	IPAddress  string
	DailyCount int
}

type riskDimension struct {
	name   string
	target string
}

// SMSService 短信服务
type SMSService struct {
	phoneRecords  map[string]*SMSRecord  // phone -> 发送记录
	ipRecords     map[string][]time.Time // ip -> 发送时间列表
	windowRecords map[string][]time.Time // risk dimension key -> 请求窗口
	penaltyUntil  map[string]time.Time   // risk dimension key -> 惩罚截止
	penaltyStrike map[string]int         // risk dimension key -> 惩罚阶梯次数
	mu            sync.RWMutex
}

var smsService = &SMSService{
	phoneRecords:  make(map[string]*SMSRecord),
	ipRecords:     make(map[string][]time.Time),
	windowRecords: make(map[string][]time.Time),
	penaltyUntil:  make(map[string]time.Time),
	penaltyStrike: make(map[string]int),
}

// GetSMSService 获取短信服务单例
func GetSMSService() *SMSService {
	return smsService
}

func smsPhoneCooldownKey(phone string) string {
	return "sms:send:cooldown:phone:" + strings.TrimSpace(phone)
}

func smsIPDailyCountKey(ipAddress string, now time.Time) string {
	date := now.In(time.Local).Format("20060102")
	return "sms:send:count:ip:" + strings.TrimSpace(ipAddress) + ":" + date
}

func smsPhoneDailyCountKey(phone string, now time.Time) string {
	date := now.In(time.Local).Format("20060102")
	return "sms:send:count:phone:" + strings.TrimSpace(phone) + ":" + date
}

func smsRiskWindowKey(dimension, target string) string {
	return "sms:risk:window:" + dimension + ":" + strings.TrimSpace(target)
}

func smsRiskPenaltyKey(dimension, target string) string {
	return "sms:risk:penalty:" + dimension + ":" + strings.TrimSpace(target)
}

func smsRiskStrikeKey(dimension, target string) string {
	return "sms:risk:strike:" + dimension + ":" + strings.TrimSpace(target)
}

func durationUntilNextLocalDay(now time.Time) time.Duration {
	localNow := now.In(time.Local)
	nextDay := time.Date(localNow.Year(), localNow.Month(), localNow.Day(), 0, 0, 0, 0, localNow.Location()).AddDate(0, 0, 1)
	ttl := nextDay.Sub(localNow)
	if ttl <= 0 {
		return 24 * time.Hour
	}
	return ttl + time.Minute
}

func smsRiskEnabled() bool {
	cfg := config.GetConfig()
	if cfg == nil {
		return true
	}
	return cfg.SMS.RiskEnabled
}

func smsPhoneDailyLimit() int {
	cfg := config.GetConfig()
	if cfg != nil && cfg.SMS.PhoneDailyLimit > 0 {
		return cfg.SMS.PhoneDailyLimit
	}
	return defaultSMSPhoneDaily
}

func smsIPDailyLimit() int {
	cfg := config.GetConfig()
	if cfg != nil && cfg.SMS.IPDailyLimit > 0 {
		return cfg.SMS.IPDailyLimit
	}
	return defaultSMSIPDailyLimit
}

func riskDimensions(phone, ipAddress, purpose string) []riskDimension {
	phone = strings.TrimSpace(phone)
	ipAddress = strings.TrimSpace(ipAddress)
	purpose = strings.TrimSpace(purpose)

	dimensions := make([]riskDimension, 0, 4)
	if ipAddress != "" {
		dimensions = append(dimensions, riskDimension{name: riskDimensionIP, target: ipAddress})
	}
	if phone != "" {
		dimensions = append(dimensions, riskDimension{name: riskDimensionPhone, target: phone})
	}
	if ipAddress != "" && phone != "" {
		dimensions = append(dimensions, riskDimension{name: riskDimensionCombo, target: ipAddress + ":" + phone})
	}
	if purpose != "" && phone != "" {
		dimensions = append(dimensions, riskDimension{name: riskDimensionPurpose, target: purpose + ":" + phone})
	}
	return dimensions
}

func penaltyWindowForStrike(strike int64) time.Duration {
	switch {
	case strike <= 1:
		return smsPenaltyStage1
	case strike == 2:
		return smsPenaltyStage2
	default:
		return smsPenaltyStage3
	}
}

func penaltyWindowForStrikeInMemory(strike int) time.Duration {
	switch {
	case strike <= 1:
		return smsPenaltyStage1
	case strike == 2:
		return smsPenaltyStage2
	default:
		return smsPenaltyStage3
	}
}

func (s *SMSService) applyPenaltyWithRedis(ctx context.Context, rdb *redis.Client, dim riskDimension) {
	strikeKey := smsRiskStrikeKey(dim.name, dim.target)
	strike, err := rdb.Incr(ctx, strikeKey).Result()
	if err != nil {
		return
	}
	if strike == 1 {
		_ = rdb.Expire(ctx, strikeKey, 24*time.Hour).Err()
	}
	penaltyDuration := penaltyWindowForStrike(strike)
	_ = rdb.Set(ctx, smsRiskPenaltyKey(dim.name, dim.target), "1", penaltyDuration).Err()
}

func (s *SMSService) applyPenaltyInMemory(dim riskDimension, now time.Time) {
	key := dim.name + ":" + dim.target
	strike := s.penaltyStrike[key] + 1
	s.penaltyStrike[key] = strike
	s.penaltyUntil[key] = now.Add(penaltyWindowForStrikeInMemory(strike))
}

func (s *SMSService) checkRiskPenaltyWithRedis(ctx context.Context, rdb *redis.Client, phone, ipAddress, purpose string) error {
	for _, dim := range riskDimensions(phone, ipAddress, purpose) {
		penaltyKey := smsRiskPenaltyKey(dim.name, dim.target)
		ttl, err := rdb.TTL(ctx, penaltyKey).Result()
		if err != nil {
			continue
		}
		if ttl > 0 {
			remainingSeconds := int(ttl.Seconds())
			if remainingSeconds <= 0 {
				remainingSeconds = 1
			}
			return fmt.Errorf("操作过于频繁，请在 %d 秒后重试", remainingSeconds)
		}
	}
	return nil
}

func (s *SMSService) checkRiskWindowWithRedis(ctx context.Context, rdb *redis.Client, phone, ipAddress, purpose string, tier SMSRiskTier) error {
	for _, dim := range riskDimensions(phone, ipAddress, purpose) {
		count, err := rdb.Get(ctx, smsRiskWindowKey(dim.name, dim.target)).Int()
		if err != nil && !errors.Is(err, redis.Nil) {
			continue
		}
		if count >= smsRiskThresholdForDimension(tier, dim.name) {
			s.applyPenaltyWithRedis(ctx, rdb, dim)
			return errors.New("请求过于频繁，已触发风控限制")
		}
	}
	return nil
}

func (s *SMSService) recordRiskWindowWithRedis(ctx context.Context, rdb *redis.Client, phone, ipAddress, purpose string, tier SMSRiskTier) {
	for _, dim := range riskDimensions(phone, ipAddress, purpose) {
		key := smsRiskWindowKey(dim.name, dim.target)
		count, err := rdb.Incr(ctx, key).Result()
		if err != nil {
			continue
		}
		if count == 1 {
			_ = rdb.Expire(ctx, key, defaultSMSRiskWindow).Err()
		}
		if int(count) > smsRiskThresholdForDimension(tier, dim.name) {
			s.applyPenaltyWithRedis(ctx, rdb, dim)
		}
	}
}

// CanSendCode 检查是否可以发送验证码
func (s *SMSService) CanSendCode(phone, ipAddress, purpose string, tier SMSRiskTier) error {
	phone = strings.TrimSpace(phone)
	ipAddress = strings.TrimSpace(ipAddress)
	purpose = strings.TrimSpace(purpose)
	tier = normalizeSMSRiskTier(tier)

	if rdb := repository.GetRedis(); rdb != nil {
		ctx, cancel := repository.RedisContext()
		defer cancel()
		return s.canSendCodeWithRedis(ctx, rdb, phone, ipAddress, purpose, tier)
	}

	return s.canSendCodeInMemory(phone, ipAddress, purpose, tier)
}

func (s *SMSService) canSendCodeWithRedis(ctx context.Context, rdb *redis.Client, phone, ipAddress, purpose string, tier SMSRiskTier) error {
	phoneKey := smsPhoneCooldownKey(phone)
	ttl, err := rdb.TTL(ctx, phoneKey).Result()
	if err == nil && ttl > 0 {
		remainingSeconds := int(ttl.Seconds())
		if remainingSeconds <= 0 {
			remainingSeconds = 1
		}
		return fmt.Errorf("操作过于频繁，请在 %d 秒后重试", remainingSeconds)
	}

	now := time.Now()
	ipLimit := smsIPDailyLimit()
	phoneLimit := smsPhoneDailyLimit()

	if ipAddress != "" {
		ipCountKey := smsIPDailyCountKey(ipAddress, now)
		ipCount, ipErr := rdb.Get(ctx, ipCountKey).Int()
		if ipErr == nil && ipCount >= ipLimit {
			return errors.New("今日发送次数已达上限，请明天再试")
		}
	}

	phoneCountKey := smsPhoneDailyCountKey(phone, now)
	phoneCount, phoneErr := rdb.Get(ctx, phoneCountKey).Int()
	if phoneErr == nil && phoneCount >= phoneLimit {
		return errors.New("该手机号今日发送次数已达上限，请明天再试")
	}

	if smsRiskEnabled() {
		if err := s.checkRiskPenaltyWithRedis(ctx, rdb, phone, ipAddress, purpose); err != nil {
			return err
		}
		if err := s.checkRiskWindowWithRedis(ctx, rdb, phone, ipAddress, purpose, tier); err != nil {
			return err
		}
	}

	return nil
}

func (s *SMSService) canSendCodeInMemory(phone, ipAddress, purpose string, tier SMSRiskTier) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()

	if record, exists := s.phoneRecords[phone]; exists {
		if now.Sub(record.SentAt) < defaultSMSPhoneCooldown {
			remainingSeconds := int(defaultSMSPhoneCooldown.Seconds() - now.Sub(record.SentAt).Seconds())
			if remainingSeconds <= 0 {
				remainingSeconds = 1
			}
			return fmt.Errorf("操作过于频繁，请在 %d 秒后重试", remainingSeconds)
		}
		if !isSameDay(record.SentAt, now) {
			record.DailyCount = 0
		}
		if record.DailyCount >= smsPhoneDailyLimit() {
			return errors.New("该手机号今日发送次数已达上限，请明天再试")
		}
	}

	if ipAddress != "" {
		times := s.ipRecords[ipAddress]
		todayTimes := make([]time.Time, 0, len(times))
		for _, t := range times {
			if isSameDay(t, now) {
				todayTimes = append(todayTimes, t)
			}
		}
		s.ipRecords[ipAddress] = todayTimes
		if len(todayTimes) >= smsIPDailyLimit() {
			return errors.New("今日发送次数已达上限，请明天再试")
		}
	}

	if smsRiskEnabled() {
		for _, dim := range riskDimensions(phone, ipAddress, purpose) {
			dimKey := dim.name + ":" + dim.target
			if until, exists := s.penaltyUntil[dimKey]; exists && now.Before(until) {
				remainingSeconds := int(time.Until(until).Seconds())
				if remainingSeconds <= 0 {
					remainingSeconds = 1
				}
				return fmt.Errorf("操作过于频繁，请在 %d 秒后重试", remainingSeconds)
			}

			windowEvents := s.windowRecords[dimKey]
			validEvents := make([]time.Time, 0, len(windowEvents))
			windowStart := now.Add(-defaultSMSRiskWindow)
			for _, eventAt := range windowEvents {
				if eventAt.After(windowStart) {
					validEvents = append(validEvents, eventAt)
				}
			}
			s.windowRecords[dimKey] = validEvents
			if len(validEvents) >= smsRiskThresholdForDimension(tier, dim.name) {
				s.applyPenaltyInMemory(dim, now)
				return errors.New("请求过于频繁，已触发风控限制")
			}
		}
	}

	return nil
}

// RecordSent 记录发送成功
func (s *SMSService) RecordSent(phone, ipAddress, purpose string, tier SMSRiskTier) {
	phone = strings.TrimSpace(phone)
	ipAddress = strings.TrimSpace(ipAddress)
	purpose = strings.TrimSpace(purpose)
	tier = normalizeSMSRiskTier(tier)

	if rdb := repository.GetRedis(); rdb != nil {
		ctx, cancel := repository.RedisContext()
		defer cancel()
		s.recordSentWithRedis(ctx, rdb, phone, ipAddress, purpose, tier)
		return
	}

	s.recordSentInMemory(phone, ipAddress, purpose, tier)
}

func (s *SMSService) recordSentWithRedis(ctx context.Context, rdb *redis.Client, phone, ipAddress, purpose string, tier SMSRiskTier) {
	_ = rdb.Set(ctx, smsPhoneCooldownKey(phone), "1", defaultSMSPhoneCooldown).Err()

	now := time.Now()
	phoneCountKey := smsPhoneDailyCountKey(phone, now)
	phoneCount, phoneErr := rdb.Incr(ctx, phoneCountKey).Result()
	if phoneErr == nil && phoneCount == 1 {
		_ = rdb.Expire(ctx, phoneCountKey, durationUntilNextLocalDay(now)).Err()
	}

	if ipAddress != "" {
		ipCountKey := smsIPDailyCountKey(ipAddress, now)
		ipCount, ipErr := rdb.Incr(ctx, ipCountKey).Result()
		if ipErr == nil && ipCount == 1 {
			_ = rdb.Expire(ctx, ipCountKey, durationUntilNextLocalDay(now)).Err()
		}
	}

	if smsRiskEnabled() {
		s.recordRiskWindowWithRedis(ctx, rdb, phone, ipAddress, purpose, tier)
	}
}

func (s *SMSService) recordSentInMemory(phone, ipAddress, purpose string, tier SMSRiskTier) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	if record, exists := s.phoneRecords[phone]; exists {
		if isSameDay(record.SentAt, now) {
			record.DailyCount++
		} else {
			record.DailyCount = 1
		}
		record.SentAt = now
		record.IPAddress = ipAddress
	} else {
		s.phoneRecords[phone] = &SMSRecord{
			Phone:      phone,
			SentAt:     now,
			IPAddress:  ipAddress,
			DailyCount: 1,
		}
	}

	if ipAddress != "" {
		s.ipRecords[ipAddress] = append(s.ipRecords[ipAddress], now)
	}

	if smsRiskEnabled() {
		windowStart := now.Add(-defaultSMSRiskWindow)
		for _, dim := range riskDimensions(phone, ipAddress, purpose) {
			dimKey := dim.name + ":" + dim.target
			events := s.windowRecords[dimKey]
			validEvents := make([]time.Time, 0, len(events)+1)
			for _, eventAt := range events {
				if eventAt.After(windowStart) {
					validEvents = append(validEvents, eventAt)
				}
			}
			validEvents = append(validEvents, now)
			s.windowRecords[dimKey] = validEvents
			if len(validEvents) > smsRiskThresholdForDimension(tier, dim.name) {
				s.applyPenaltyInMemory(dim, now)
			}
		}
	}
}

// CleanupOldRecords 清理过期记录（定时任务调用）
func (s *SMSService) CleanupOldRecords() {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	for phone, record := range s.phoneRecords {
		if now.Sub(record.SentAt) > 24*time.Hour {
			delete(s.phoneRecords, phone)
		}
	}

	for ip, times := range s.ipRecords {
		validTimes := make([]time.Time, 0, len(times))
		for _, t := range times {
			if now.Sub(t) <= 24*time.Hour {
				validTimes = append(validTimes, t)
			}
		}
		if len(validTimes) == 0 {
			delete(s.ipRecords, ip)
		} else {
			s.ipRecords[ip] = validTimes
		}
	}

	for key, events := range s.windowRecords {
		validEvents := make([]time.Time, 0, len(events))
		windowStart := now.Add(-defaultSMSRiskWindow)
		for _, eventAt := range events {
			if eventAt.After(windowStart) {
				validEvents = append(validEvents, eventAt)
			}
		}
		if len(validEvents) == 0 {
			delete(s.windowRecords, key)
		} else {
			s.windowRecords[key] = validEvents
		}
	}

	for key, until := range s.penaltyUntil {
		if now.After(until) {
			delete(s.penaltyUntil, key)
		}
	}
}

// isSameDay 判断是否同一天
func isSameDay(t1, t2 time.Time) bool {
	y1, m1, d1 := t1.Date()
	y2, m2, d2 := t2.Date()
	return y1 == y2 && m1 == m2 && d1 == d2
}
