package tencentim

import (
	"bytes"
	"compress/zlib"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"strconv"
	"time"
)

// GenUserSig 生成腾讯云 IM UserSig 签名
// sdkAppID: 腾讯云 IM 应用 ID
// secretKey: 腾讯云 IM 密钥
// userID: 用户 ID
// expire: 签名有效期（秒）
func GenUserSig(sdkAppID int, secretKey, userID string, expire int) (string, error) {
	currTime := time.Now().Unix()

	sigDoc := map[string]interface{}{
		"TLS.ver":        "2.0",
		"TLS.identifier": userID,
		"TLS.sdkappid":   sdkAppID,
		"TLS.expire":     expire,
		"TLS.time":       currTime,
	}

	// 生成 sig 字符串
	sigStr := genSig(userID, sdkAppID, currTime, int64(expire), secretKey)
	sigDoc["TLS.sig"] = sigStr

	// 序列化为 JSON
	jsonData, err := json.Marshal(sigDoc)
	if err != nil {
		return "", err
	}

	// zlib 压缩
	var compressed bytes.Buffer
	w := zlib.NewWriter(&compressed)
	_, err = w.Write(jsonData)
	if err != nil {
		return "", err
	}
	w.Close()

	// Base64 编码（URL 安全）
	return base64URLEncode(compressed.Bytes()), nil
}

// genSig 生成 HMAC-SHA256 签名
func genSig(userID string, sdkAppID int, currTime, expire int64, secretKey string) string {
	contentToBeSigned := "TLS.identifier:" + userID + "\n" +
		"TLS.sdkappid:" + strconv.Itoa(sdkAppID) + "\n" +
		"TLS.time:" + strconv.FormatInt(currTime, 10) + "\n" +
		"TLS.expire:" + strconv.FormatInt(expire, 10) + "\n"

	h := hmac.New(sha256.New, []byte(secretKey))
	h.Write([]byte(contentToBeSigned))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}

// base64URLEncode Base64 URL 安全编码
func base64URLEncode(data []byte) string {
	encoded := base64.StdEncoding.EncodeToString(data)
	// 替换为 URL 安全字符
	result := ""
	for _, c := range encoded {
		switch c {
		case '+':
			result += "*"
		case '/':
			result += "-"
		case '=':
			result += "_"
		default:
			result += string(c)
		}
	}
	return result
}
