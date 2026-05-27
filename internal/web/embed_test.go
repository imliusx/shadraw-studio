package web

import (
	"io/fs"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

// requireBuiltDist skips the test when the embedded dist contains only the
// .gitkeep placeholder. In CI / a fresh checkout, dist is empty until the
// frontend is built and copied in; in that case we have nothing to assert on.
func requireBuiltDist(t *testing.T) {
	t.Helper()
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		t.Fatalf("fs.Sub: %v", err)
	}
	if _, err := fs.Stat(sub, "index.html"); err != nil {
		t.Skipf("skipping: dist/index.html not present (build frontend and copy dist to internal/web/dist/ to enable)")
	}
}

func newTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	// Pretend we have an API group registered; NoRoute should pick up everything else.
	r.GET("/api/v1/healthz", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})
	r.NoRoute(Handler())
	return r
}

func do(t *testing.T, r *gin.Engine, path string) *httptest.ResponseRecorder {
	t.Helper()
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	r.ServeHTTP(w, req)
	return w
}

func TestHandler_ServesIndexAtRoot(t *testing.T) {
	requireBuiltDist(t)
	r := newTestRouter()
	w := do(t, r, "/")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	body := w.Body.String()
	if !strings.Contains(body, `id="root"`) {
		t.Fatalf("expected index.html with #root div, got: %q", body[:min(200, len(body))])
	}
}

func TestHandler_SPAFallbackForExtensionlessRoute(t *testing.T) {
	requireBuiltDist(t)
	r := newTestRouter()
	// /gallery has no extension and no file in dist → must fallback to index.html
	w := do(t, r, "/gallery")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), `id="root"`) {
		t.Fatalf("expected SPA fallback to index.html, got body without #root")
	}
}

func TestHandler_AssetMissReturns404(t *testing.T) {
	r := newTestRouter()
	w := do(t, r, "/assets/nonexistent-typo-xyz.js")
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for missing asset, got %d", w.Code)
	}
}

func TestHandler_ServesPublicAsset(t *testing.T) {
	requireBuiltDist(t)
	r := newTestRouter()
	// icon.svg ships in public/ and lands at dist root with a stable name.
	w := do(t, r, "/icon.svg")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for /icon.svg, got %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); !strings.Contains(ct, "svg") && !strings.Contains(ct, "xml") {
		t.Fatalf("expected svg/xml content-type, got %q", ct)
	}
}

func TestHandler_APIRouteUnaffected(t *testing.T) {
	r := newTestRouter()
	w := do(t, r, "/api/v1/healthz")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 from API handler, got %d", w.Code)
	}
	if got := w.Body.String(); got != "ok" {
		t.Fatalf("expected body 'ok', got %q", got)
	}
}

func TestHandler_ServesIndexExplicit(t *testing.T) {
	requireBuiltDist(t)
	r := newTestRouter()
	w := do(t, r, "/index.html")
	// http.FileServer redirects "/index.html" to "/" by convention. Either is acceptable.
	if w.Code != http.StatusOK && w.Code != http.StatusMovedPermanently {
		t.Fatalf("expected 200 or 301 for /index.html, got %d", w.Code)
	}
	if w.Code == http.StatusOK && !strings.Contains(w.Body.String(), `id="root"`) {
		t.Fatalf("expected /index.html to serve index.html with #root")
	}
}
