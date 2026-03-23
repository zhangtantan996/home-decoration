package service

import (
	"errors"
	"os"
	"strconv"
	"strings"
	"unicode/utf8"

	"home-decoration-server/internal/model"
	"home-decoration-server/pkg/utils"
)

func encryptSensitiveString(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", nil
	}
	if strings.TrimSpace(os.Getenv("ENCRYPTION_KEY")) == "" {
		return "", errors.New("ENCRYPTION_KEY 未配置")
	}
	return utils.Encrypt(value)
}

func maskAddressForStorage(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}

	length := utf8.RuneCountInString(value)
	switch {
	case length <= 4:
		return "***"
	case length <= 8:
		runes := []rune(value)
		return string(runes[:2]) + "***"
	default:
		runes := []rune(value)
		return string(runes[:3]) + "***" + string(runes[length-2:])
	}
}

func encryptBookingSensitiveFields(booking *model.Booking) error {
	if booking == nil {
		return nil
	}

	if encrypted, err := encryptSensitiveString(booking.Address); err != nil {
		return err
	} else if encrypted != "" {
		booking.AddressEncrypted = encrypted
		booking.Address = maskAddressForStorage(booking.Address)
	}

	if encrypted, err := encryptSensitiveString(booking.Phone); err != nil {
		return err
	} else if encrypted != "" {
		booking.PhoneEncrypted = encrypted
		booking.Phone = utils.MaskPhone(strings.TrimSpace(booking.Phone))
	}

	if encrypted, err := encryptSensitiveString(booking.Notes); err != nil {
		return err
	} else if encrypted != "" {
		booking.NotesEncrypted = encrypted
		booking.Notes = "[encrypted]"
	}

	return nil
}

func encryptProjectSensitiveFields(project *model.Project) error {
	if project == nil {
		return nil
	}

	if encrypted, err := encryptSensitiveString(project.Address); err != nil {
		return err
	} else if encrypted != "" {
		project.AddressEncrypted = encrypted
		project.Address = maskAddressForStorage(project.Address)
	}

	if project.Latitude != 0 {
		encrypted, err := encryptSensitiveString(strconv.FormatFloat(project.Latitude, 'f', -1, 64))
		if err != nil {
			return err
		}
		project.LatitudeEncrypted = encrypted
		project.Latitude = 0
	}

	if project.Longitude != 0 {
		encrypted, err := encryptSensitiveString(strconv.FormatFloat(project.Longitude, 'f', -1, 64))
		if err != nil {
			return err
		}
		project.LongitudeEncrypted = encrypted
		project.Longitude = 0
	}

	return nil
}
