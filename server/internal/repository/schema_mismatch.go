package repository

import (
	"errors"
	"fmt"
	"strings"

	"github.com/lib/pq"
)

const CanonicalSchemaReconcileMigrationPath = "server/migrations/v1.6.9_reconcile_high_risk_schema_guard.sql"

type sqlStateError interface {
	SQLState() string
}

func IsSchemaMismatchError(err error) bool {
	if err == nil {
		return false
	}

	var pqErr *pq.Error
	if errors.As(err, &pqErr) {
		switch string(pqErr.Code) {
		case "42703", "42P01", "42883":
			return true
		}
	}

	var stateErr sqlStateError
	if errors.As(err, &stateErr) {
		switch strings.TrimSpace(stateErr.SQLState()) {
		case "42703", "42P01", "42883":
			return true
		}
	}

	errText := strings.ToLower(strings.TrimSpace(err.Error()))
	for _, fragment := range []string{
		"no such column",
		"no such table",
		"does not exist",
		"has no column named",
		"cached plan must not change result type",
	} {
		if strings.Contains(errText, fragment) {
			return true
		}
	}

	return false
}

func SchemaServiceUnavailableMessage(scope string) string {
	scope = strings.TrimSpace(scope)
	if scope == "" {
		scope = "服务"
	}
	return fmt.Sprintf("%s暂时不可用，数据库结构未就绪", scope)
}
