package model

import (
	"encoding/base64"
	"testing"

	"home-decoration-server/pkg/utils"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestMerchantBankAccountEncryptsAtRestAndDecryptsOnRead(t *testing.T) {
	t.Setenv("ENCRYPTION_KEY", base64.StdEncoding.EncodeToString([]byte("12345678901234567890123456789012")))
	if err := utils.InitCrypto(); err != nil {
		t.Fatalf("init crypto: %v", err)
	}

	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&MerchantBankAccount{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	const plainAccountNo = "6222021234567890123"
	account := MerchantBankAccount{
		ProviderID:  2001,
		AccountName: "测试商家",
		AccountNo:   plainAccountNo,
		BankName:    "招商银行",
		BranchName:  "深圳南山支行",
		Status:      1,
	}
	if err := db.Create(&account).Error; err != nil {
		t.Fatalf("create account: %v", err)
	}

	var raw struct {
		AccountNo string
	}
	if err := db.Table(account.TableName()).Select("account_no").Where("id = ?", account.ID).Take(&raw).Error; err != nil {
		t.Fatalf("query raw account: %v", err)
	}
	if raw.AccountNo == plainAccountNo {
		t.Fatalf("expected stored account no to be encrypted, got plain text %q", raw.AccountNo)
	}

	var stored MerchantBankAccount
	if err := db.First(&stored, account.ID).Error; err != nil {
		t.Fatalf("load account: %v", err)
	}
	if stored.AccountNo != plainAccountNo {
		t.Fatalf("expected account no to decrypt on read, got %q", stored.AccountNo)
	}
	if got, want := stored.MaskedAccountNo(), utils.MaskBankAccount(plainAccountNo); got != want {
		t.Fatalf("expected masked account no %q, got %q", want, got)
	}
}
