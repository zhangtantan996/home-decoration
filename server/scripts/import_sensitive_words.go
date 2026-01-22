package main

import (
	"bufio"
	"flag"
	"fmt"
	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"log"
	"os"
	"strings"

	"gorm.io/gorm/clause"
)

// 批量导入敏感词
//
// 支持两种格式：
// 1) TXT: 每行一个词；可用前缀 "re:" 标记为正则
// 2) CSV(逗号分隔): word,category,level,action,is_regex
//
// 用法示例：
//
//	go run ./server/scripts/import_sensitive_words.go -file sensitive_words.txt
//	go run ./server/scripts/import_sensitive_words.go -file words.csv
func main() {
	filePath := flag.String("file", "", "path to txt/csv word list")
	defaultCategory := flag.String("category", "", "default category for TXT lines")
	defaultLevel := flag.String("level", "normal", "default level for TXT lines")
	defaultAction := flag.String("action", "review", "default action for TXT lines")
	flag.Parse()

	if strings.TrimSpace(*filePath) == "" {
		log.Fatal("missing required flag: -file")
	}

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}
	if err := repository.InitDB(&cfg.Database); err != nil {
		log.Fatalf("Failed to connect database: %v", err)
	}

	f, err := os.Open(*filePath)
	if err != nil {
		log.Fatalf("Failed to open file: %v", err)
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	batch := make([]model.SensitiveWord, 0, 1000)
	lines := 0
	parsed := 0
	var inserted int64

	flush := func() {
		if len(batch) == 0 {
			return
		}
		res := repository.DB.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "word"}},
			DoNothing: true,
		}).Create(&batch)
		if res.Error != nil {
			log.Fatalf("Import failed: %v", res.Error)
		}
		inserted += res.RowsAffected
		batch = batch[:0]
	}

	for scanner.Scan() {
		lines++
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		if strings.HasPrefix(line, "#") || strings.HasPrefix(line, "//") {
			continue
		}
		w, ok := parseSensitiveWordLine(line, strings.TrimSpace(*defaultCategory), strings.TrimSpace(*defaultLevel), strings.TrimSpace(*defaultAction))
		if !ok {
			continue
		}
		parsed++
		batch = append(batch, w)
		if len(batch) >= 1000 {
			flush()
		}
	}
	if err := scanner.Err(); err != nil {
		log.Fatalf("Read file failed: %v", err)
	}
	flush()

	fmt.Printf("Import finished: lines=%d parsed=%d inserted=%d\n", lines, parsed, inserted)
}

func parseSensitiveWordLine(line, defaultCategory, defaultLevel, defaultAction string) (model.SensitiveWord, bool) {
	line = strings.TrimSpace(line)
	if line == "" {
		return model.SensitiveWord{}, false
	}

	isRegex := false
	wordText := line
	if strings.HasPrefix(strings.ToLower(wordText), "re:") {
		isRegex = true
		wordText = strings.TrimSpace(wordText[3:])
	}
	if wordText == "" {
		return model.SensitiveWord{}, false
	}

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
		return model.SensitiveWord{Word: word, Category: category, Level: level, Action: action, IsRegex: isRegex}, true
	}

	return model.SensitiveWord{Word: wordText, Category: defaultCategory, Level: defaultLevel, Action: defaultAction, IsRegex: isRegex}, true
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
