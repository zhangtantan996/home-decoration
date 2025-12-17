# Build Stage
FROM golang:1.23-alpine AS builder

# Set environment variables
ENV GO111MODULE=on \
    GOPROXY=https://goproxy.cn,direct \
    CGO_ENABLED=0 \
    GOOS=linux \
    GOARCH=amd64

WORKDIR /app

# Copy go mod and sum files (from server directory)
COPY server/go.mod server/go.sum ./
RUN go mod download

# Copy source code (server directory)
COPY server/ .

# Build the application
RUN go build -o main ./cmd/api

# Final Stage
FROM alpine:latest

# Install timezone data and certificates
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/main .
COPY --from=builder /app/config.yaml .

# Expose port
EXPOSE 8080

# Run
CMD ["./main"]
