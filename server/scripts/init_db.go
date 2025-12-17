package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/lib/pq"
)

func main() {
	// 连接到默认postgres数据库
	connStr := "host=localhost port=5432 user=postgres password=123456 dbname=postgres sslmode=disable"
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal("Failed to connect:", err)
	}
	defer db.Close()

	// 检查数据库是否存在
	var exists bool
	err = db.QueryRow("SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = 'home_decoration')").Scan(&exists)
	if err != nil {
		log.Fatal("Query failed:", err)
	}

	if exists {
		fmt.Println("Database 'home_decoration' already exists")
		return
	}

	// 创建数据库
	_, err = db.Exec("CREATE DATABASE home_decoration")
	if err != nil {
		log.Fatal("Failed to create database:", err)
	}

	fmt.Println("Database 'home_decoration' created successfully!")
}
