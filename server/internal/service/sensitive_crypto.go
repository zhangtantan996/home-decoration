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

// PrepareBookingNotesForStorage returns the persisted display value and encrypted value for booking notes.
func PrepareBookingNotesForStorage(notes string) (string, string, error) {
	notes = strings.TrimSpace(notes)
	if notes == "" {
		return "", "", nil
	}
	encrypted, err := encryptSensitiveString(notes)
	if err != nil {
		return "", "", err
	}
	if encrypted == "" {
		return notes, "", nil
	}
	return "[encrypted]", encrypted, nil
}

func restoreEncryptedString(maskedValue, encryptedValue string) (string, error) {
	if strings.TrimSpace(encryptedValue) == "" {
		return strings.TrimSpace(maskedValue), nil
	}
	decrypted, err := utils.Decrypt(encryptedValue)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(decrypted), nil
}

// RestoreBookingSensitiveFields restores encrypted booking fields for privileged internal flows.
func RestoreBookingSensitiveFields(booking *model.Booking) error {
	if booking == nil {
		return nil
	}
	address, err := restoreEncryptedString(booking.Address, booking.AddressEncrypted)
	if err != nil {
		return err
	}
	phone, err := restoreEncryptedString(booking.Phone, booking.PhoneEncrypted)
	if err != nil {
		return err
	}
	notes, err := restoreEncryptedString(booking.Notes, booking.NotesEncrypted)
	if err != nil {
		return err
	}
	booking.Address = address
	booking.Phone = phone
	booking.Notes = notes
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

func encryptQuoteInquirySensitiveFields(inquiry *model.QuoteInquiry) error {
	if inquiry == nil {
		return nil
	}

	if encrypted, err := encryptSensitiveString(inquiry.Address); err != nil {
		return err
	} else if encrypted != "" {
		inquiry.AddressEncrypted = encrypted
		inquiry.Address = maskAddressForStorage(inquiry.Address)
	}

	if encrypted, err := encryptSensitiveString(inquiry.Phone); err != nil {
		return err
	} else if encrypted != "" {
		inquiry.PhoneEncrypted = encrypted
		inquiry.Phone = utils.MaskPhone(strings.TrimSpace(inquiry.Phone))
	}

	return nil
}

// RestoreQuoteInquirySensitiveFields restores encrypted quote inquiry fields for privileged internal flows.
func RestoreQuoteInquirySensitiveFields(inquiry *model.QuoteInquiry) error {
	if inquiry == nil {
		return nil
	}
	address, err := restoreEncryptedString(inquiry.Address, inquiry.AddressEncrypted)
	if err != nil {
		return err
	}
	phone, err := restoreEncryptedString(inquiry.Phone, inquiry.PhoneEncrypted)
	if err != nil {
		return err
	}
	inquiry.Address = address
	inquiry.Phone = phone
	return nil
}
