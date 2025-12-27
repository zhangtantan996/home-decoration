package service

import (
	"errors"
	"sync"
	"time"
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
	phoneRecords map[string]*SMSRecord // 手机号 -> 发送记录
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

// CanSendCode 检查是否可以发送验证码
func (s *SMSService) CanSendCode(phone, ipAddress string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()

	// 检查手机号60秒限制
	if record, exists := s.phoneRecords[phone]; exists {
		if now.Sub(record.SentAt) < 60*time.Second {
			remainingSeconds := int(60 - now.Sub(record.SentAt).Seconds())
			return errors.New(formatString("操作过于频繁，请在 %d 秒后重试", remainingSeconds))
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

// formatString 格式化字符串（简化版）
func formatString(format string, a ...interface{}) string {
	// 简单的字符串格式化
	result := format
	for _, v := range a {
		// 这里简化处理，实际应该使用 fmt.Sprintf
		switch val := v.(type) {
		case int:
			result = replaceFirst(result, "%d", itoa(val))
		case string:
			result = replaceFirst(result, "%s", val)
		}
	}
	return result
}

func replaceFirst(s, old, new string) string {
	for i := 0; i < len(s)-len(old)+1; i++ {
		if s[i:i+len(old)] == old {
			return s[:i] + new + s[i+len(old):]
		}
	}
	return s
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	if n < 0 {
		return "-" + itoa(-n)
	}

	var digits []byte
	for n > 0 {
		digits = append([]byte{byte('0' + n%10)}, digits...)
		n /= 10
	}
	return string(digits)
}
