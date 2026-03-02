package service

import (
	"errors"
	"fmt"
	"home-decoration-server/internal/repository"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// SMSRecord 短信发送记录
type SMSRecord struct {
	Phone      string
	SentAt     time.Time
	IPAddress  string
	DailyCount int
}

// SMSService 短信服务
type SMSService struct {
	phoneRecords map[string]*SMSRecord  // 手机号 -> 发送记录
	ipRecords    map[string][]time.Time // IP -> 发送时间列表
	mu           sync.RWMutex
}

var smsService = &SMSService{
	phoneRecords: make(map[string]*SMSRecord),
	ipRecords:    make(map[string][]time.Time),
}

// GetSMSService 获取短信服务单例
func GetSMSService() *SMSService {
	return smsService
}

func smsPhoneCooldownKey(phone string) string {
	return "sms:send:cooldown:phone:" + phone
}

func smsIPDailyCountKey(ipAddress string, now time.Time) string {
	date := now.In(time.Local).Format("20060102")
	return "sms:send:count:ip:" + ipAddress + ":" + date
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

// CanSendCode 检查是否可以发送验证码
func (s *SMSService) CanSendCode(phone, ipAddress string) error {
	if rdb := repository.GetRedis(); rdb != nil {
		ctx, cancel := repository.RedisContext()
		defer cancel()

		phoneKey := smsPhoneCooldownKey(phone)
		ttl, err := rdb.TTL(ctx, phoneKey).Result()
		if err == nil && ttl > 0 {
			remainingSeconds := int(ttl.Seconds())
			if remainingSeconds <= 0 {
				remainingSeconds = 1
			}
			return fmt.Errorf("操作过于频繁，请在 %d 秒后重试", remainingSeconds)
		}
		if err != nil {
			return s.canSendCodeInMemory(phone, ipAddress)
		}

		ipKey := smsIPDailyCountKey(ipAddress, time.Now())
		count, err := rdb.Get(ctx, ipKey).Int()
		if err == nil && count >= 20 {
			return errors.New("今日发送次数已达上限，请明天再试")
		}
		if err != nil && !errors.Is(err, redis.Nil) {
			return s.canSendCodeInMemory(phone, ipAddress)
		}

		return nil
	}

	return s.canSendCodeInMemory(phone, ipAddress)
}

func (s *SMSService) canSendCodeInMemory(phone, ipAddress string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()

	// 检查手机号60秒限制
	if record, exists := s.phoneRecords[phone]; exists {
		if now.Sub(record.SentAt) < 60*time.Second {
			remainingSeconds := int(60 - now.Sub(record.SentAt).Seconds())
			return fmt.Errorf("操作过于频繁，请在 %d 秒后重试", remainingSeconds)
		}

		// 检查是否是同一天
		if !isSameDay(record.SentAt, now) {
			record.DailyCount = 0
		}
	}

	// 检查IP每天20次限制
	if times, exists := s.ipRecords[ipAddress]; exists {
		// 清理非今天的记录
		var todayTimes []time.Time
		for _, t := range times {
			if isSameDay(t, now) {
				todayTimes = append(todayTimes, t)
			}
		}
		s.ipRecords[ipAddress] = todayTimes

		if len(todayTimes) >= 20 {
			return errors.New("今日发送次数已达上限，请明天再试")
		}
	}

	return nil
}

// RecordSent 记录发送成功
func (s *SMSService) RecordSent(phone, ipAddress string) {
	if rdb := repository.GetRedis(); rdb != nil {
		ctx, cancel := repository.RedisContext()
		defer cancel()

		_ = rdb.Set(ctx, smsPhoneCooldownKey(phone), "1", 60*time.Second).Err()

		now := time.Now()
		ipKey := smsIPDailyCountKey(ipAddress, now)
		count, err := rdb.Incr(ctx, ipKey).Result()
		if err == nil && count == 1 {
			_ = rdb.Expire(ctx, ipKey, durationUntilNextLocalDay(now)).Err()
		}
		return
	}

	s.recordSentInMemory(phone, ipAddress)
}

func (s *SMSService) recordSentInMemory(phone, ipAddress string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()

	// 更新手机号记录
	if record, exists := s.phoneRecords[phone]; exists {
		if isSameDay(record.SentAt, now) {
			record.DailyCount++
		} else {
			record.DailyCount = 1
		}
		record.SentAt = now
	} else {
		s.phoneRecords[phone] = &SMSRecord{
			Phone:      phone,
			SentAt:     now,
			DailyCount: 1,
		}
	}

	// 更新IP记录
	s.ipRecords[ipAddress] = append(s.ipRecords[ipAddress], now)
}

// CleanupOldRecords 清理过期记录（定时任务调用）
func (s *SMSService) CleanupOldRecords() {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()

	// 清理超过24小时的手机号记录
	for phone, record := range s.phoneRecords {
		if now.Sub(record.SentAt) > 24*time.Hour {
			delete(s.phoneRecords, phone)
		}
	}

	// 清理IP记录
	for ip, times := range s.ipRecords {
		var validTimes []time.Time
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
}

// isSameDay 判断是否同一天
func isSameDay(t1, t2 time.Time) bool {
	y1, m1, d1 := t1.Date()
	y2, m2, d2 := t2.Date()
	return y1 == y2 && m1 == m2 && d1 == d2
}
