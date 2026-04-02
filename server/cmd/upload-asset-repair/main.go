package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/repository"
	"home-decoration-server/internal/utils/assetaudit"
)

func main() {
	log.SetFlags(0)

	sampleLimit := flag.Int("sample-limit", 20, "max samples to print")
	jsonOutput := flag.Bool("json", false, "print json summary")
	dryRun := flag.Bool("dry-run", false, "scan only, do not write back")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		fmt.Printf("ERROR: load config failed: %v\n", err)
		os.Exit(1)
	}
	if err := repository.InitDB(&cfg.Database); err != nil {
		fmt.Printf("ERROR: init db failed: %v\n", err)
		os.Exit(1)
	}
	defer repository.CloseDB()

	runner := assetaudit.NewRunner(repository.DB, *sampleLimit)
	summary, err := runner.Run(assetaudit.DefaultSpecs(), assetaudit.RunOptions{
		Apply:       !*dryRun,
		SampleLimit: *sampleLimit,
	})
	if err != nil {
		fmt.Printf("ERROR: repair failed: %v\n", err)
		os.Exit(1)
	}

	if *jsonOutput {
		encoded, _ := json.MarshalIndent(summary, "", "  ")
		fmt.Println(string(encoded))
		return
	}

	title := "上传资产正式回卷"
	if *dryRun {
		title = "上传资产回卷预演"
	}
	fmt.Printf("=== %s ===\n", title)
	fmt.Printf("总记录数: %d\n", summary.TotalRecords)
	fmt.Printf("命中字段数: %d\n", summary.MatchedFields)
	fmt.Printf("成功回卷数: %d\n", summary.RepairedFields)
	fmt.Printf("外链跳过数: %d\n", summary.ExternalSkipped)
	fmt.Printf("异常样本数: %d\n\n", summary.Errors)

	for _, table := range summary.Tables {
		fmt.Printf("[%s] records=%d matched=%d repaired=%d external=%d errors=%d\n",
			table.Table,
			table.Records,
			table.MatchedFields,
			table.RepairedFields,
			table.ExternalSkipped,
			table.Errors,
		)
	}

	if len(summary.Samples) == 0 {
		return
	}

	fmt.Println("\n典型样本:")
	for _, sample := range summary.Samples {
		fmt.Printf("- %s.%s#%s | %s\n", sample.Table, sample.Column, sample.RecordID, sample.Note)
		if sample.Before != "" {
			fmt.Printf("  before: %s\n", sample.Before)
		}
		if sample.After != "" {
			fmt.Printf("  after : %s\n", sample.After)
		}
	}
}
