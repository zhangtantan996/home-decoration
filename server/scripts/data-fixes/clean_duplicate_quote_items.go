package main

import (
    "fmt"
    "log"

    "home-decoration-server/internal/model"
    "gorm.io/driver/postgres"
    "gorm.io/gorm"
)

func main() {
    dsn := "host=localhost user=postgres password=IXwUBjxFia33XltiY0wFch8n3N68hptI dbname=home_decoration port=5432 sslmode=disable TimeZone=Asia/Shanghai"
    
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
