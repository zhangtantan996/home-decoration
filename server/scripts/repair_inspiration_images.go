//go:build ignore

package main

import (
	"flag"
	"log"

	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	imgutil "home-decoration-server/internal/utils/image"
)

func main() {
	dryRun := flag.Bool("dry-run", false, "scan and report repairs without writing database updates")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	if err := repository.InitDB(&cfg.Database); err != nil {
		log.Fatalf("init db: %v", err)
	}

	var providerCases []model.ProviderCase
	if err := repository.DB.Where("show_in_inspiration = ?", true).Find(&providerCases).Error; err != nil {
		log.Fatalf("query inspiration cases: %v", err)
	}

	updated := 0
	failed := 0
	for _, providerCase := range providerCases {
		coverImage, imagesJSON, changed := imgutil.RepairInspirationCaseAssets(
			providerCase.ID,
			providerCase.CoverImage,
			providerCase.Images,
			cfg.Server.PublicURL,
		)
		if !changed {
			continue
		}

		updated++
		if *dryRun {
			log.Printf("[dry-run] case=%d cover=%q -> %q", providerCase.ID, providerCase.CoverImage, coverImage)
			continue
		}

		if err := repository.DB.Model(&model.ProviderCase{}).
			Where("id = ?", providerCase.ID).
			Updates(map[string]interface{}{
				"cover_image": coverImage,
				"images":      imagesJSON,
			}).Error; err != nil {
			failed++
			log.Printf("repair case %d failed: %v", providerCase.ID, err)
		}
	}

	log.Printf("scan complete: total=%d updated=%d failed=%d dry_run=%t", len(providerCases), updated, failed, *dryRun)
}
