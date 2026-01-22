package handler

import (
	"bufio"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"home-decoration-server/pkg/response"
	"io"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm/clause"
)

const (
	defaultSensitiveWordAction = "review"
	defaultSensitiveWordLevel  = "normal"
)

// AdminImportSensitiveWords 批量导入敏感词（用于导入大词库）
//
// 支持两种格式：
// 1) TXT: 每行一个词；可用前缀 "re:" 标记为正则
// 2) CSV(逗号分隔): word,category,level,action,is_regex
//
// 使用 on-conflict do nothing，避免覆盖管理员手工调整过的规则。
func AdminImportSensitiveWords(c *gin.Context) {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, "请上传文件(file)")
		return
	}

	f, err := fileHeader.Open()
	if err != nil {
		response.ServerError(c, "读取文件失败")
		return
	}
	defer f.Close()

	defaultCategory := strings.TrimSpace(c.PostForm("defaultCategory"))
	defaultLevel := strings.TrimSpace(c.PostForm("defaultLevel"))
	defaultAction := strings.TrimSpace(c.PostForm("defaultAction"))
	if defaultLevel == "" {
		defaultLevel = defaultSensitiveWordLevel
	}
	if defaultAction == "" {
		defaultAction = defaultSensitiveWordAction
	}

	scanner := bufio.NewScanner(f)
	// Large word lists may contain long regex lines; increase the per-line buffer.
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	batch := make([]model.SensitiveWord, 0, 1000)
	totalLines := 0
	parsed := 0
	var inserted int64

	flush := func() error {
		if len(batch) == 0 {
			return nil
		}
		res := repository.DB.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "word"}},
			DoNothing: true,
		}).Create(&batch)
		if res.Error != nil {
			return res.Error
		}
		inserted += res.RowsAffected
		batch = batch[:0]
		return nil
	}

	for scanner.Scan() {
		totalLines++
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		if strings.HasPrefix(line, "#") || strings.HasPrefix(line, "//") {
			continue
		}

		w, ok := parseSensitiveWordLine(line, defaultCategory, defaultLevel, defaultAction)
		if !ok {
			continue
		}
		parsed++
		batch = append(batch, w)
		if len(batch) >= 1000 {
			if err := flush(); err != nil {
				response.ServerError(c, "导入失败")
				return
			}
		}
	}
	if err := scanner.Err(); err != nil && err != io.EOF {
		response.ServerError(c, "读取文件失败")
		return
	}
	if err := flush(); err != nil {
		response.ServerError(c, "导入失败")
		return
	}

	response.Success(c, gin.H{
		"message":  "导入完成",
		"lines":    totalLines,
		"parsed":   parsed,
		"inserted": inserted,
	})
}

func parseSensitiveWordLine(line, defaultCategory, defaultLevel, defaultAction string) (model.SensitiveWord, bool) {
	line = strings.TrimSpace(line)
	if line == "" {
		return model.SensitiveWord{}, false
	}

	// TXT regex prefix
	isRegex := false
	wordText := line
	if strings.HasPrefix(strings.ToLower(wordText), "re:") {
		isRegex = true
		wordText = strings.TrimSpace(wordText[3:])
	}
	if wordText == "" {
		return model.SensitiveWord{}, false
	}

	// CSV format: word,category,level,action,is_regex
	parts := strings.Split(line, ",")
	if len(parts) >= 4 {
		word := strings.TrimSpace(parts[0])
		if word == "" {
			return model.SensitiveWord{}, false
		}
		category := strings.TrimSpace(parts[1])
		level := strings.TrimSpace(parts[2])
		action := strings.TrimSpace(parts[3])
		if category == "" {
			category = defaultCategory
		}
		if level == "" {
			level = defaultLevel
		}
		if action == "" {
			action = defaultAction
		}
		if len(parts) >= 5 {
			if v, ok := parseLooseBool(parts[4]); ok {
				isRegex = v
			}
		}
		return model.SensitiveWord{
			Word:     word,
			Category: category,
			Level:    level,
			Action:   action,
			IsRegex:  isRegex,
		}, true
	}

	return model.SensitiveWord{
		Word:     wordText,
		Category: defaultCategory,
		Level:    defaultLevel,
		Action:   defaultAction,
		IsRegex:  isRegex,
	}, true
}

func parseLooseBool(s string) (bool, bool) {
	s = strings.ToLower(strings.TrimSpace(s))
	switch s {
	case "1", "true", "yes", "y":
		return true, true
	case "0", "false", "no", "n":
		return false, true
	default:
		return false, false
	}
}
