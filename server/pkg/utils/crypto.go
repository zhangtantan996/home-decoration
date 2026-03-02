package utils

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"strings"
)

// Crypto 加密工具
// 用于加密敏感数据：身份证号、银行账号等
type Crypto struct {
	key []byte
}

var defaultCrypto *Crypto

// InitCrypto 初始化加密工具
// 从环境变量获取密钥，密钥必须是32字节(AES-256)
// 🔒 安全要求：生产环境必须设置 ENCRYPTION_KEY 环境变量，否则拒绝启动
func InitCrypto() error {
	keyStr := strings.TrimSpace(os.Getenv("ENCRYPTION_KEY"))
	if keyStr == "" {
		errMsg := fmt.Sprintf(
			"❌ 安全错误：ENCRYPTION_KEY 环境变量未设置！\n\n" +
			"敏感数据（身份证号、银行卡号）需要加密存储，必须设置32字节加密密钥。\n\n" +
			"生成密钥命令:\n" +
			"  Linux/macOS: openssl rand -base64 32\n" +
			"  Windows:     使用在线生成器或 Git Bash 执行上述命令\n\n" +
			"设置方法:\n" +
			"  export ENCRYPTION_KEY=\"your_generated_32_byte_key\"\n" +
			"  或在 .env 文件中添加: ENCRYPTION_KEY=your_generated_32_byte_key\n\n" +
			"⚠️  服务器拒绝启动以保护数据安全。",
		)
		log.Fatal(errMsg)
		return errors.New("ENCRYPTION_KEY not set")
	}

	// Support both:
	// 1) raw 32-byte string (len(keyStr)==32)
	// 2) base64-encoded 32-byte key (recommended; e.g. `openssl rand -base64 32`)
	if decoded, err := base64.StdEncoding.DecodeString(keyStr); err == nil && len(decoded) == 32 {
		defaultCrypto = &Crypto{key: decoded}
		log.Println("✅ 加密工具初始化成功 (AES-256-GCM) [base64 key]")
		return nil
	}

	key := []byte(keyStr)
	if len(key) != 32 {
		return fmt.Errorf("ENCRYPTION_KEY 必须为32字节（原始字符串长度=32），或 base64 解码后为32字节。当前长度=%d", len(key))
	}

	defaultCrypto = &Crypto{key: key}
	log.Println("✅ 加密工具初始化成功 (AES-256-GCM) [raw key]")
	return nil
}

// Encrypt 加密数据
func Encrypt(plaintext string) (string, error) {
	if defaultCrypto == nil {
		InitCrypto()
	}
	return defaultCrypto.Encrypt(plaintext)
}

// Decrypt 解密数据
func Decrypt(ciphertext string) (string, error) {
	if defaultCrypto == nil {
		InitCrypto()
	}
	return defaultCrypto.Decrypt(ciphertext)
}

// Encrypt 加密
func (c *Crypto) Encrypt(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}

	block, err := aes.NewCipher(c.key)
	if err != nil {
		return "", err
	}

	// 使用GCM模式（推荐，提供认证加密）
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	// 生成随机nonce
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	// 加密并附加nonce
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt 解密
func (c *Crypto) Decrypt(ciphertext string) (string, error) {
	if ciphertext == "" {
		return "", nil
	}

	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(c.key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	if len(data) < gcm.NonceSize() {
		return "", errors.New("ciphertext too short")
	}

	nonce, ciphertextBytes := data[:gcm.NonceSize()], data[gcm.NonceSize():]
	plaintext, err := gcm.Open(nil, nonce, ciphertextBytes, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

// MaskIDCard 身份证号脱敏显示
// 输入: 110101199003071234 => 1101**********1234
func MaskIDCard(idCard string) string {
	if len(idCard) < 10 {
		return idCard
	}
	return idCard[:4] + "**********" + idCard[len(idCard)-4:]
}

// MaskBankAccount 银行账号脱敏显示
// 输入: 6222021234567890123 => 6222****0123
func MaskBankAccount(account string) string {
	if len(account) < 8 {
		return account
	}
	return account[:4] + "****" + account[len(account)-4:]
}

// MaskPhone 手机号脱敏显示
// 输入: 13812345678 => 138****5678
func MaskPhone(phone string) string {
	if len(phone) < 7 {
		return phone
	}
	return phone[:3] + "****" + phone[len(phone)-4:]
}
