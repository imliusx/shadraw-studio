package record

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/liusx/shadraw/internal/blob"
	"github.com/liusx/shadraw/internal/httpx"
	"github.com/liusx/shadraw/internal/imagegen"
)

type fakeRecordStore struct {
	created      []*Record
	failedRecord *Record
}

func (f *fakeRecordStore) CreateIfBelowUnfinishedLimit(_ context.Context, rec *Record, limit int) error {
	var unfinished int64
	for _, existing := range f.created {
		if existing.UserID == rec.UserID && (existing.Status == StatusWaiting || existing.Status == StatusRunning) {
			unfinished++
		}
	}
	if unfinished >= int64(limit) {
		return ErrQueueLimitReached
	}
	rec.ID = int64(len(f.created) + 1)
	rec.UUID = "00000000-0000-0000-0000-000000000001"
	rec.CreatedAt = time.Unix(0, 0).UTC()
	copyRec := *rec
	f.created = append(f.created, &copyRec)
	return nil
}

func (f *fakeRecordStore) RetryFailedIfBelowUnfinishedLimit(_ context.Context, id, userID int64, limit int) (*Record, error) {
	var unfinished int64
	for _, rec := range f.created {
		if rec.UserID == userID && (rec.Status == StatusWaiting || rec.Status == StatusRunning) {
			unfinished++
		}
	}
	if unfinished >= int64(limit) {
		return nil, ErrQueueLimitReached
	}
	if f.failedRecord == nil || f.failedRecord.ID != id || f.failedRecord.UserID != userID || f.failedRecord.Status != StatusFailed {
		return nil, ErrNotFound
	}
	f.failedRecord.Status = StatusWaiting
	f.failedRecord.Error = nil
	return f.failedRecord, nil
}

func (f *fakeRecordStore) FindByID(_ context.Context, id, userID int64) (*Record, error) {
	for _, rec := range f.created {
		if rec.ID == id && (userID == 0 || rec.UserID == userID) {
			copyRec := *rec
			return &copyRec, nil
		}
	}
	if f.failedRecord != nil && f.failedRecord.ID == id && (userID == 0 || f.failedRecord.UserID == userID) {
		copyRec := *f.failedRecord
		return &copyRec, nil
	}
	return nil, ErrNotFound
}

func (f *fakeRecordStore) FindVisibleImageByID(context.Context, int64, int64) (*Record, error) {
	panic("unexpected call")
}
func (f *fakeRecordStore) List(context.Context, ListParams) ([]Record, int64, error) {
	panic("unexpected call")
}
func (f *fakeRecordStore) ListPublic(context.Context, int64, PublicListParams) ([]Record, int64, error) {
	panic("unexpected call")
}
func (f *fakeRecordStore) UpdateFavorite(context.Context, int64, int64, bool) error {
	panic("unexpected call")
}
func (f *fakeRecordStore) UpdatePublic(context.Context, int64, int64, bool, bool) error {
	panic("unexpected call")
}
func (f *fakeRecordStore) UpdateProject(context.Context, int64, int64, *int64) error {
	panic("unexpected call")
}
func (f *fakeRecordStore) Delete(context.Context, int64, int64) (*Record, error) {
	panic("unexpected call")
}

type fakeProjectStore struct{}

func (fakeProjectStore) Create(context.Context, *Project) error { panic("unexpected call") }
func (fakeProjectStore) List(context.Context, int64) ([]Project, error) {
	panic("unexpected call")
}
func (fakeProjectStore) FindByID(context.Context, int64, int64) (*Project, error) {
	panic("unexpected call")
}
func (fakeProjectStore) Rename(context.Context, int64, int64, string) error {
	panic("unexpected call")
}
func (fakeProjectStore) Delete(context.Context, int64, int64) error { panic("unexpected call") }

type fakeUpstreamConfig struct {
	models     []string
	queueLimit int
}

func (f fakeUpstreamConfig) EnabledModels() []string { return f.models }
func (f fakeUpstreamConfig) PerUserQueueLimit() int  { return f.queueLimit }

type fakeBlobStore struct{}

func (fakeBlobStore) Put(context.Context, string, string, string, []byte) (string, error) {
	panic("unexpected call")
}
func (fakeBlobStore) Get(context.Context, string, io.Writer) error { return blob.ErrNotFound }
func (fakeBlobStore) Delete(context.Context, string) error         { return nil }
func (fakeBlobStore) Stat(context.Context, string) (int64, error)  { return 0, blob.ErrNotFound }

func newRecordHandlerTestRig(store *fakeRecordStore, limit int) *gin.Engine {
	gin.SetMode(gin.TestMode)
	h := &Handler{
		records:  store,
		projects: fakeProjectStore{},
		blob:     fakeBlobStore{},
		upstream: fakeUpstreamConfig{models: []string{"gpt-image-2"}, queueLimit: limit},
	}
	engine := gin.New()
	engine.Use(httpx.Recovery())
	engine.Use(func(c *gin.Context) {
		httpx.SetAuth(c, "7", "user")
		c.Next()
	})
	engine.POST("/api/v1/records", h.Create)
	engine.POST("/api/v1/records/:id/retry", h.Retry)
	return engine
}

func postJSON(t *testing.T, engine *gin.Engine, path string, body any) *httptest.ResponseRecorder {
	t.Helper()
	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	engine.ServeHTTP(w, req)
	return w
}

func decodeEnvelope(t *testing.T, body []byte) httpx.Envelope {
	t.Helper()
	var env httpx.Envelope
	if err := json.Unmarshal(body, &env); err != nil {
		t.Fatalf("decode envelope: %v\nraw=%s", err, body)
	}
	return env
}

func TestHandler_Create_QueueLimit429DoesNotInsert(t *testing.T) {
	store := &fakeRecordStore{created: []*Record{{ID: 99, UserID: 7, Status: StatusWaiting}}}
	engine := newRecordHandlerTestRig(store, 1)

	w := postJSON(t, engine, "/api/v1/records", CreateRecordReq{
		Prompt:      "a red chair",
		Model:       "gpt-image-2",
		ImageParams: &imagegen.Params{Size: "1024x1024"},
	})

	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want 429, body=%s", w.Code, w.Body.String())
	}
	if w.Header().Get("Retry-After") != "30" {
		t.Fatalf("Retry-After = %q, want 30", w.Header().Get("Retry-After"))
	}
	env := decodeEnvelope(t, w.Body.Bytes())
	if env.Error == nil || env.Error.Code != httpx.CodeRateLimited {
		t.Fatalf("error = %+v, want rate_limited", env.Error)
	}
	if got := len(store.created); got != 1 {
		t.Fatalf("created count = %d, want unchanged 1", got)
	}
}

func TestHandler_Retry_QueueLimit429LeavesFailedRecord(t *testing.T) {
	msg := "failed before retry"
	store := &fakeRecordStore{
		created: []*Record{{ID: 88, UserID: 7, Status: StatusRunning}},
		failedRecord: &Record{
			ID:          42,
			UUID:        "00000000-0000-0000-0000-000000000042",
			UserID:      7,
			Prompt:      "failed prompt",
			Model:       "gpt-image-2",
			ImageParams: imagegen.Params{Size: "1024x1024"},
			Status:      StatusFailed,
			Error:       &msg,
			CreatedAt:   time.Unix(0, 0).UTC(),
		},
	}
	engine := newRecordHandlerTestRig(store, 1)

	w := postJSON(t, engine, "/api/v1/records/42/retry", gin.H{})

	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want 429, body=%s", w.Code, w.Body.String())
	}
	if w.Header().Get("Retry-After") != "30" {
		t.Fatalf("Retry-After = %q, want 30", w.Header().Get("Retry-After"))
	}
	env := decodeEnvelope(t, w.Body.Bytes())
	if env.Error == nil || env.Error.Code != httpx.CodeRateLimited {
		t.Fatalf("error = %+v, want rate_limited", env.Error)
	}
	if store.failedRecord.Status != StatusFailed {
		t.Fatalf("failed record status = %q, want failed", store.failedRecord.Status)
	}
	if store.failedRecord.Error == nil || *store.failedRecord.Error != msg {
		t.Fatalf("failed record error = %v, want unchanged", store.failedRecord.Error)
	}
}
