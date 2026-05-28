package record

import (
	"strings"
	"testing"
)

func TestOldestEligibleWaitingSQL_UsesPerUserRunningCapAndFairOrder(t *testing.T) {
	sql, args := oldestEligibleWaitingSQL(nil)
	mustContain := []string{
		"FROM records r",
		"r.status = 'waiting'",
		"SELECT count(*)",
		"running.user_id = r.user_id",
		"running.status = 'running'",
		") < ?",
		"ORDER BY r.id ASC",
		"FOR UPDATE SKIP LOCKED",
	}
	for _, part := range mustContain {
		if !strings.Contains(sql, part) {
			t.Fatalf("claim SQL missing %q:\n%s", part, sql)
		}
	}
	if len(args) != 1 {
		t.Fatalf("args len = %d, want 1", len(args))
	}
}

func TestOldestEligibleWaitingSQL_CanSkipTemporarilyLockedUsers(t *testing.T) {
	sql, args := oldestEligibleWaitingSQL([]int64{1, 2})
	if !strings.Contains(sql, "r.user_id NOT IN ?") {
		t.Fatalf("claim SQL should exclude locked users:\n%s", sql)
	}
	if len(args) != 2 {
		t.Fatalf("args len = %d, want 2", len(args))
	}
	users, ok := args[1].([]int64)
	if !ok || len(users) != 2 || users[0] != 1 || users[1] != 2 {
		t.Fatalf("excluded users arg = %#v, want [1 2]", args[1])
	}
}

func TestNormalizePerUserWorkerConcurrency(t *testing.T) {
	tests := []struct {
		name string
		in   int
		want int
	}{
		{name: "below min", in: 0, want: 1},
		{name: "within range", in: 2, want: 2},
		{name: "above max", in: 20, want: 16},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := normalizePerUserWorkerConcurrency(tt.in); got != tt.want {
				t.Fatalf("normalizePerUserWorkerConcurrency(%d) = %d, want %d", tt.in, got, tt.want)
			}
		})
	}
}
