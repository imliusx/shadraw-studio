// Package web serves the embedded Vite SPA build output.
//
// The Vite dist directory is embedded at compile time via `go:embed all:dist`.
// At runtime, Handler returns a gin.HandlerFunc that:
//   - serves static assets directly when the request path matches a file inside dist;
//   - returns 404 for missing requests that look like asset requests (paths with
//     a file extension), so the browser can surface broken resource loads;
//   - falls back to index.html for any extensionless path so the client-side
//     React Router can take over (SPA fallback).
package web

import (
	"embed"
	"errors"
	"io/fs"
	"net/http"
	"path"
	"strings"

	"github.com/gin-gonic/gin"
)

//go:embed all:dist
var distFS embed.FS

// Handler returns a gin.HandlerFunc that serves the embedded SPA bundle.
// It is intended to be registered via engine.NoRoute after all API routes
// so that any non-API path falls through to the SPA.
func Handler() gin.HandlerFunc {
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		panic(err)
	}
	fileServer := http.FileServer(http.FS(sub))

	return func(c *gin.Context) {
		reqPath := strings.TrimPrefix(c.Request.URL.Path, "/")
		if reqPath == "" {
			reqPath = "index.html"
		}

		if _, err := fs.Stat(sub, reqPath); err != nil {
			if !errors.Is(err, fs.ErrNotExist) {
				c.Status(http.StatusInternalServerError)
				return
			}
			// Asset-like miss (path has an extension) → real 404 so the
			// browser surfaces the broken resource.
			if ext := path.Ext(reqPath); ext != "" {
				c.Status(http.StatusNotFound)
				return
			}
			// Extensionless route miss → SPA fallback to index.html.
			c.Request.URL.Path = "/"
		}

		fileServer.ServeHTTP(c.Writer, c.Request)
	}
}
