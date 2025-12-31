package main

import (
	"fmt"
	"home-decoration-server/internal/config"
	"home-decoration-server/internal/model"
	"home-decoration-server/internal/repository"
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	// Initialize DB with Silent logger
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Overwrite logger
	repository.DB, err = gorm.Open(postgres.Open(cfg.Database.GetDSN()), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})

	// Dump last 5 Bookings
	var bookings []model.Booking
	repository.DB.Order("id desc").Limit(5).Find(&bookings)
	fmt.Println("=== Recent Bookings ===")
	for _, b := range bookings {
		fmt.Printf("ID: %d, UserID: %d, Status: %d, Address: %s\n", b.ID, b.UserID, b.Status, b.Address)
	}

	// Dump last 5 Proposals
	var proposals []model.Proposal
	repository.DB.Order("id desc").Limit(5).Find(&proposals)
	fmt.Println("\n=== Recent Proposals ===")
	for _, p := range proposals {
		fmt.Printf("ID: %d, BookingID: %d, Status: %d, ConfirmedAt: %v\n", p.ID, p.BookingID, p.Status, p.ConfirmedAt)
	}

	// Dump last 5 Orders
	var orders []model.Order
	repository.DB.Order("id desc").Limit(5).Find(&orders)
	fmt.Println("\n=== Recent Orders ===")
	for _, o := range orders {
		fmt.Printf("ID: %d, OrderNo: %s, Type: %s, Status: %d, ProposalID: %d, BookingID: %d\n", o.ID, o.OrderNo, o.OrderType, o.Status, o.ProposalID, o.BookingID)

		// Check linkage
		var b model.Booking
		repository.DB.First(&b, o.BookingID)
		fmt.Printf("  -> Linked Booking UserID: %d\n", b.UserID)
	}

	// Check Projects
	var projects []model.Project
	repository.DB.Find(&projects)
	fmt.Println("\n=== All Projects ===")
	for _, p := range projects {
		fmt.Printf("ID: %d, OwnerID: %d, Name: %s, Address: %s\n", p.ID, p.OwnerID, p.Name, p.Address)
	}

	// Check UserType
	var u model.User
	if len(bookings) > 0 {
		repository.DB.First(&u, bookings[0].UserID)
		fmt.Printf("\nUser (ID: %d) Type: %d\n", u.ID, u.UserType)

		// Check Conflict Logic
		var count int64
		booking := bookings[0]
		repository.DB.Model(&model.Project{}).
			Where("owner_id = ? AND address = ?", u.ID, booking.Address).
			Count(&count)
		fmt.Printf("Conflict Check: OwnerID=%d, Address='%s', Count=%d\n", u.ID, booking.Address, count)
	}

	// Check specific logic from ListProjects
	fmt.Println("\n=== Testing ListProjects Logic ===")
	// Assume UserID is the one from the most recent booking
	if len(bookings) > 0 {
		userID := bookings[0].UserID
		fmt.Printf("Testing for UserID: %d\n", userID)

		var proposalIDs []uint64
		err := repository.DB.Table("orders").
			Joins("JOIN bookings ON bookings.id = orders.booking_id").
			Where("bookings.user_id = ? AND orders.order_type = ?", userID, "design").
			Pluck("orders.proposal_id", &proposalIDs).Error

		fmt.Printf("Found ProposalIDs: %v, Error: %v\n", proposalIDs, err)
	}
}
