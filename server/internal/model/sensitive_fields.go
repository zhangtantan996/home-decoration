package model

import (
	"errors"
	"os"
	"strconv"
	"strings"

	"home-decoration-server/pkg/utils"

	"gorm.io/gorm"
)

func encryptionReady() bool {
	return strings.TrimSpace(os.Getenv("ENCRYPTION_KEY")) != ""
}

func tryDecryptString(value string) (string, bool) {
	value = strings.TrimSpace(value)
	if value == "" || !encryptionReady() {
		return "", false
	}

	plain, err := utils.Decrypt(value)
	if err != nil {
		return "", false
	}
	return plain, true
}

func encryptStringForStorage(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", nil
	}
	if _, ok := tryDecryptString(value); ok {
		return value, nil
	}
	if !encryptionReady() {
		return "", errors.New("ENCRYPTION_KEY 未配置")
	}
	return utils.Encrypt(value)
}

func (p *Project) AfterFind(_ *gorm.DB) error {
	if plain, ok := tryDecryptString(p.AddressEncrypted); ok {
		p.Address = plain
	}
	if plain, ok := tryDecryptString(p.LatitudeEncrypted); ok {
		if parsed, err := strconv.ParseFloat(plain, 64); err == nil {
			p.Latitude = parsed
		}
	}
	if plain, ok := tryDecryptString(p.LongitudeEncrypted); ok {
		if parsed, err := strconv.ParseFloat(plain, 64); err == nil {
			p.Longitude = parsed
		}
	}
	return nil
}

func (b *Booking) AfterFind(_ *gorm.DB) error {
	if plain, ok := tryDecryptString(b.AddressEncrypted); ok {
		b.Address = plain
	}
	if plain, ok := tryDecryptString(b.PhoneEncrypted); ok {
		b.Phone = plain
	}
	if plain, ok := tryDecryptString(b.NotesEncrypted); ok {
		b.Notes = plain
	}
	return nil
}

func (q *QuoteInquiry) AfterFind(_ *gorm.DB) error {
	if plain, ok := tryDecryptString(q.AddressEncrypted); ok {
		q.Address = plain
	}
	if plain, ok := tryDecryptString(q.PhoneEncrypted); ok {
		q.Phone = plain
	}
	return nil
}

func (m *MerchantBankAccount) BeforeSave(_ *gorm.DB) error {
	encrypted, err := encryptStringForStorage(m.AccountNo)
	if err != nil {
		return err
	}
	if encrypted != "" {
		m.AccountNo = encrypted
	}
	return nil
}

func (m *MerchantBankAccount) AfterFind(_ *gorm.DB) error {
	if plain, ok := tryDecryptString(m.AccountNo); ok {
		m.AccountNo = plain
	}
	return nil
}

func (m MerchantBankAccount) MaskedAccountNo() string {
	value := strings.TrimSpace(m.AccountNo)
	if value == "" {
		return ""
	}
	if plain, ok := tryDecryptString(value); ok {
		return utils.MaskBankAccount(plain)
	}
	if strings.Contains(value, "*") {
		return value
	}
	if !encryptionReady() {
		return "****"
	}
	return utils.MaskBankAccount(value)
}
