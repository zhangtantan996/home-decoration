package service

import (
	"regexp"
	"testing"
)

func TestGenerateDesignOrderNoFormat(t *testing.T) {
	orderNo, err := generateDesignOrderNo()
	if err != nil {
		t.Fatalf("expected order number, got %v", err)
	}

	if matched := regexp.MustCompile(`^DF\d{18}$`).MatchString(orderNo); !matched {
		t.Fatalf("unexpected order number format: %s", orderNo)
	}
}

func TestSecureRandomIntRange(t *testing.T) {
	for i := 0; i < 8; i++ {
		n, err := secureRandomInt(10000)
		if err != nil {
			t.Fatalf("secureRandomInt returned error: %v", err)
		}
		if n < 0 || n >= 10000 {
			t.Fatalf("secureRandomInt out of range: %d", n)
		}
	}
}
