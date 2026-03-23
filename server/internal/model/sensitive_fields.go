package model

import (
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
