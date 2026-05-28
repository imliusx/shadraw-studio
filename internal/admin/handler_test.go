package admin

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/liusx/shadraw/internal/httpx"
)

type fakeRuntimeStore struct {
	settings RuntimeSettingsDTO
	updated  RuntimeSettingsDTO
	actorID  int64
}

func (f *fakeRuntimeStore) RuntimeSettings() RuntimeSettingsDTO { return f.settings }

func (f *fakeRuntimeStore) UpdateRuntimeSettings(_ context.Context, settings RuntimeSettingsDTO, actorID int64) error {
	f.settings = settings
	f.updated = settings
	f.actorID = actorID
	return nil
}

func newRuntimeHandlerTestRig(store *fakeRuntimeStore) *gin.Engine {
	gin.SetMode(gin.TestMode)
	h := &Handler{runtimeStore: store}
	engine := gin.New()
	engine.Use(httpx.Recovery())
	engine.Use(func(c *gin.Context) {
		httpx.SetAuth(c, "12", "admin")
		c.Next()
	})
	engine.GET("/api/v1/admin/runtime", h.GetRuntime)
	engine.PATCH("/api/v1/admin/runtime", h.UpdateRuntime)
	return engine
}

func runtimeReq(t *testing.T, engine *gin.Engine, method, path string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var rdr *bytes.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal request: %v", err)
		}
		rdr = bytes.NewReader(payload)
	} else {
		rdr = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, path, rdr)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	engine.ServeHTTP(w, req)
	return w
}

func TestHandler_GetRuntime_ReturnsAllRuntimeSettings(t *testing.T) {
	store := &fakeRuntimeStore{settings: RuntimeSettingsDTO{
		WorkerConcurrency:        4,
		PerUserWorkerConcurrency: 2,
		PerUserQueueLimit:        5,
	}}
	engine := newRuntimeHandlerTestRig(store)

	w := runtimeReq(t, engine, http.MethodGet, "/api/v1/admin/runtime", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200, body=%s", w.Code, w.Body.String())
	}
	var env struct {
		Data  RuntimeSettingsDTO `json:"data"`
		Error *httpx.Error       `json:"error"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if env.Error != nil {
		t.Fatalf("error = %+v, want nil", env.Error)
	}
	if env.Data != store.settings {
		t.Fatalf("data = %+v, want %+v", env.Data, store.settings)
	}
}

func TestHandler_UpdateRuntime_UpdatesAllRuntimeSettings(t *testing.T) {
	store := &fakeRuntimeStore{settings: RuntimeSettingsDTO{
		WorkerConcurrency:        4,
		PerUserWorkerConcurrency: 1,
		PerUserQueueLimit:        5,
	}}
	engine := newRuntimeHandlerTestRig(store)

	w := runtimeReq(t, engine, http.MethodPatch, "/api/v1/admin/runtime", RuntimeSettingsDTO{
		WorkerConcurrency:        6,
		PerUserWorkerConcurrency: 2,
		PerUserQueueLimit:        8,
	})

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200, body=%s", w.Code, w.Body.String())
	}
	if store.updated.WorkerConcurrency != 6 || store.updated.PerUserWorkerConcurrency != 2 || store.updated.PerUserQueueLimit != 8 {
		t.Fatalf("updated = %+v, want all fields persisted", store.updated)
	}
	if store.actorID != 12 {
		t.Fatalf("actorID = %d, want 12", store.actorID)
	}
}

func TestHandler_UpdateRuntime_Validation422(t *testing.T) {
	store := &fakeRuntimeStore{settings: RuntimeSettingsDTO{
		WorkerConcurrency:        4,
		PerUserWorkerConcurrency: 1,
		PerUserQueueLimit:        5,
	}}
	engine := newRuntimeHandlerTestRig(store)

	w := runtimeReq(t, engine, http.MethodPatch, "/api/v1/admin/runtime", gin.H{
		"workerConcurrency":        4,
		"perUserWorkerConcurrency": 0,
		"perUserQueueLimit":        17,
	})

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422, body=%s", w.Code, w.Body.String())
	}
	var env struct {
		Data  any          `json:"data"`
		Error *httpx.Error `json:"error"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if env.Error == nil || env.Error.Code != httpx.CodeValidationFailed {
		t.Fatalf("error = %+v, want validation_failed", env.Error)
	}
	if len(env.Error.Fields) == 0 {
		t.Fatalf("fields = %+v, want validation details", env.Error.Fields)
	}
	if store.updated != (RuntimeSettingsDTO{}) {
		t.Fatalf("updated = %+v, want no update on validation failure", store.updated)
	}
}
