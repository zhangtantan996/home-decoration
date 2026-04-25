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

	var badCategories []model.QuoteCategory
	err = db.Where("name LIKE ? AND name != ?", "防水-%", "防水-1774417560").Find(&badCategories).Error
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Found %d bad categories.\n", len(badCategories))

	for _, c := range badCategories {
		fmt.Printf("Deleting items for category %s (ID: %d)\n", c.Name, c.ID)
		err = db.Where("category_l1 = ? OR category_l2 = ?", c.Name, c.Name).Delete(&model.QuoteLibraryItem{}).Error
		if err != nil {
			fmt.Println("Error deleting items:", err)
		}

		err = db.Delete(&model.QuoteCategory{}, c.ID).Error
		if err != nil {
			fmt.Println("Error deleting category:", err)
		}
	}

	fmt.Println("Cleanup complete.")
}
