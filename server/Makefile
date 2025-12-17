.PHONY: build run dev test clean

# 应用名称
APP_NAME=home-decoration-server

# 构建
build:
	go build -o bin/$(APP_NAME) ./cmd/api

# 运行
run: build
	./bin/$(APP_NAME)

# 开发模式 (热重载需要安装 air)
dev:
	air

# 测试
test:
	go test -v ./...

# 清理
clean:
	rm -rf bin/

# 下载依赖
deps:
	go mod download
	go mod tidy

# 格式化代码
fmt:
	go fmt ./...

# 代码检查
lint:
	golangci-lint run

# 生成 Swagger 文档
swagger:
	swag init -g cmd/api/main.go -o docs

# Docker 构建
docker-build:
	docker build -t $(APP_NAME):latest .

# Docker 运行
docker-run:
	docker run -p 8080:8080 $(APP_NAME):latest
