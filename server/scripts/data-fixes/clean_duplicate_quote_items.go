//go:build ignore
// +build ignore

package main

import (
	"fmt"
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"home-decoration-server/internal/model"
)

func main() {
	dsn := os.Getenv("DATABASE_DSN")
	if dsn == "" {
		log.Fatal("DATABASE_DSN is required")
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}

	var badItems []model.QuoteListItem
	err = db.Where("name LIKE ? AND name != ?", "墙地面防水-%", "墙地面防水-1774417560").Find(&badItems).Error
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Found %d bad quote list items.\n", len(badItems))

	for _, item := range badItems {
		fmt.Printf("Deleting quote list item %s (ID: %d)\n", item.Name, item.ID)
		err = db.Delete(&model.QuoteListItem{}, item.ID).Error
		if err != nil {
			fmt.Println("Error deleting quote list item:", err)
		}
	}

	fmt.Println("Cleanup complete.")
}
