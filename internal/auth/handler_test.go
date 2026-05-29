package auth_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/liusx/shadraw/internal/auth"
	"github.com/liusx/shadraw/internal/httpx"
	"github.com/liusx/shadraw/internal/user"
)

// ---- fake stores duplicated here because service_test fakes are in the
// auth package (which httptest tests cannot import the test file from).

type fakeUsers struct {
	byID    map[int64]*user.User
	byEmail map[string]int64
	nextID  int64
}

func newFakeUsers() *fakeUsers {
	return &fakeUsers{byID: map[int64]*user.User{}, byEmail: map[string]int64{}}
}

func (f *fakeUsers) FindByEmail(_ context.Context, email string) (*user.User, error) {
	id, ok := f.byEmail[strings.ToLower(email)]
	if !ok {
		return nil, user.ErrNotFound
	}
	c := *f.byID[id]
	return &c, nil
}

func (f *fakeUsers) FindByID(_ context.Context, id int64) (*user.User, error) {
	u, ok := f.byID[id]
	if !ok {
		return nil, user.ErrNotFound
	}
	c := *u
	return &c, nil
}

func (f *fakeUsers) Create(_ context.Context, u *user.User) error {
	f.nextID++
	u.ID = f.nextID
	u.CreatedAt = time.Now()
	u.UpdatedAt = u.CreatedAt
	c := *u
	f.byID[u.ID] = &c
	f.byEmail[strings.ToLower(u.Email)] = u.ID
	return nil
}

func (f *fakeUsers) UpdatePassword(_ context.Context, id int64, hash string, mustChange bool) error {
	u, ok := f.byID[id]
	if !ok {
		return user.ErrNotFound
	}
	u.PasswordHash = hash
	u.MustChangePassword = mustChange
	return nil
}

func (f *fakeUsers) EmailExists(_ context.Context, email string) (bool, error) {
	_, ok := f.byEmail[strings.ToLower(email)]
	return ok, nil
}

type fakeRefresh struct {
	rows   map[int64]*auth.RefreshToken
	byHash map[string]int64
	nextID int64
}

func newFakeRefresh() *fakeRefresh {
	return &fakeRefresh{rows: map[int64]*auth.RefreshToken{}, byHash: map[string]int64{}}
}

func (f *fakeRefresh) Create(_ context.Context, t *auth.RefreshToken) error {
	f.nextID++
	t.ID = f.nextID
	c := *t
	f.rows[t.ID] = &c
	f.byHash[t.TokenHash] = t.ID
	return nil
}

func (f *fakeRefresh) FindByHash(_ context.Context, hash string) (*auth.RefreshToken, error) {
	id, ok := f.byHash[hash]
	if !ok {
		return nil, auth.ErrRefreshNotFound
	}
	c := *f.rows[id]
	return &c, nil
}

func (f *fakeRefresh) Revoke(_ context.Context, id int64) error {
	t, ok := f.rows[id]
	if !ok {
		return auth.ErrRefreshNotFound
	}
	t.Revoked = true
	return nil
}

func (f *fakeRefresh) RevokeAllForUser(_ context.Context, userID int64) error {
	for _, t := range f.rows {
		if t.UserID == userID {
			t.Revoked = true
		}
	}
	return nil
}

// ---- test scaffolding ---------------------------------------------------

type testRig struct {
	engine  *gin.Engine
	svc     *auth.Service
	handler *auth.Handler
	users   *fakeUsers
	refresh *fakeRefresh
	policy  *fakeRegistrationPolicy
	secret  string
}

type fakeRegistrationPolicy struct {
	enabled bool
}

func (f *fakeRegistrationPolicy) RegistrationEnabled() bool { return f.enabled }

func newRig(t *testing.T) *testRig {
	t.Helper()
	gin.SetMode(gin.TestMode)
	users := newFakeUsers()
	refresh := newFakeRefresh()
	secret := "test-secret-of-thirty-two-chars!"
	policy := &fakeRegistrationPolicy{enabled: true}

	// We need to expose newServiceImpl; provide via test helper in package.
	svc := auth.NewServiceForTest(users, refresh, secret, time.Now)
	h := auth.NewHandler(svc, policy)

	engine := gin.New()
	engine.Use(httpx.Recovery())

	v1 := engine.Group("/api/v1")
	v1.POST("/auth/register", h.RegisterEndpoint)
	v1.POST("/auth/login", h.LoginEndpoint)
	v1.POST("/auth/refresh", h.RefreshEndpoint)
	v1.POST("/auth/logout", h.LogoutEndpoint)

	secured := v1.Group("")
	secured.Use(auth.RequireAuth(secret, users))
	secured.GET("/auth/me", h.MeEndpoint)
	secured.POST("/auth/password", h.ChangePasswordEndpoint)

	return &testRig{
		engine: engine, svc: svc, handler: h,
		users: users, refresh: refresh, policy: policy, secret: secret,
	}
}

// ---- helpers -------------------------------------------------------------

func (r *testRig) do(t *testing.T, method, path string, body any, bearer string) *httptest.ResponseRecorder {
	t.Helper()
	var rdr *bytes.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rdr = bytes.NewReader(b)
	} else {
		rdr = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, path, rdr)
	req.Header.Set("Content-Type", "application/json")
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	w := httptest.NewRecorder()
	r.engine.ServeHTTP(w, req)
	return w
}

func decode(t *testing.T, body []byte) httpx.Envelope {
	t.Helper()
	var e httpx.Envelope
	if err := json.Unmarshal(body, &e); err != nil {
		t.Fatalf("decode: %v\nraw=%s", err, body)
	}
	return e
}

func registerOK(t *testing.T, r *testRig, email, pw string) auth.AuthResponse {
	t.Helper()
	w := r.do(t, http.MethodPost, "/api/v1/auth/register", auth.RegisterReq{
		Email: email, Password: pw, DisplayName: "u",
	}, "")
	if w.Code != http.StatusCreated {
		t.Fatalf("register: status=%d body=%s", w.Code, w.Body.String())
	}
	var env struct {
		Data  auth.AuthResponse `json:"data"`
		Error any               `json:"error"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("decode register: %v", err)
	}
	if env.Data.Tokens.RefreshToken != "" {
		t.Fatalf("refresh token should not be returned in JSON")
	}
	return env.Data
}

func refreshCookieFrom(t *testing.T, w *httptest.ResponseRecorder) *http.Cookie {
	t.Helper()
	for _, cookie := range w.Result().Cookies() {
		if cookie.Name == "shadraw_refresh" {
			return cookie
		}
	}
	t.Fatalf("missing shadraw_refresh cookie; set-cookie=%q", w.Header().Values("Set-Cookie"))
	return nil
}

func registerOKWithCookie(t *testing.T, r *testRig, email, pw string) (auth.AuthResponse, *http.Cookie) {
	t.Helper()
	w := r.do(t, http.MethodPost, "/api/v1/auth/register", auth.RegisterReq{
		Email: email, Password: pw, DisplayName: "u",
	}, "")
	if w.Code != http.StatusCreated {
		t.Fatalf("register: status=%d body=%s", w.Code, w.Body.String())
	}
	var env struct {
		Data  auth.AuthResponse `json:"data"`
		Error any               `json:"error"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("decode register: %v", err)
	}
	return env.Data, refreshCookieFrom(t, w)
}

func (r *testRig) doWithCookies(t *testing.T, method, path string, body any, bearer string, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	var rdr *bytes.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rdr = bytes.NewReader(b)
	} else {
		rdr = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, path, rdr)
	req.Header.Set("Content-Type", "application/json")
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	for _, cookie := range cookies {
		req.AddCookie(cookie)
	}
	w := httptest.NewRecorder()
	r.engine.ServeHTTP(w, req)
	return w
}

// ---- tests ---------------------------------------------------------------

func TestHandler_Register_201(t *testing.T) {
	r := newRig(t)
	resp, cookie := registerOKWithCookie(t, r, "a@b.com", "12345678")
	if resp.User.Email != "a@b.com" {
		t.Fatalf("user.email = %q", resp.User.Email)
	}
	if _, err := strconv.ParseInt(resp.User.ID, 10, 64); err != nil {
		t.Fatalf("user.id should be a string-encoded number, got %q", resp.User.ID)
	}
	if !cookie.HttpOnly {
		t.Fatalf("refresh cookie should be HttpOnly")
	}
	if cookie.Path != "/api/v1/auth" {
		t.Fatalf("refresh cookie path = %q, want /api/v1/auth", cookie.Path)
	}
	if cookie.SameSite != http.SameSiteLaxMode {
		t.Fatalf("refresh cookie SameSite = %v, want Lax", cookie.SameSite)
	}
}

func TestHandler_Register_SecureCookieBehindHTTPSProxy(t *testing.T) {
	r := newRig(t)
	body, _ := json.Marshal(auth.RegisterReq{
		Email: "secure@b.com", Password: "12345678", DisplayName: "u",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Forwarded-Proto", "https")
	w := httptest.NewRecorder()

	r.engine.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("register: status=%d body=%s", w.Code, w.Body.String())
	}
	cookie := refreshCookieFrom(t, w)
	if !cookie.Secure {
		t.Fatalf("refresh cookie should be Secure behind HTTPS proxy")
	}
}

func TestHandler_Register_409_Duplicate(t *testing.T) {
	r := newRig(t)
	_ = registerOK(t, r, "dup@x.com", "12345678")
	w := r.do(t, http.MethodPost, "/api/v1/auth/register", auth.RegisterReq{
		Email: "dup@x.com", Password: "12345678", DisplayName: "u",
	}, "")
	if w.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409", w.Code)
	}
	env := decode(t, w.Body.Bytes())
	if env.Error == nil || env.Error.Code != httpx.CodeConflict {
		t.Fatalf("err = %+v", env.Error)
	}
}

func TestHandler_Register_403_WhenRegistrationDisabled(t *testing.T) {
	r := newRig(t)
	r.policy.enabled = false

	w := r.do(t, http.MethodPost, "/api/v1/auth/register", auth.RegisterReq{
		Email: "closed@x.com", Password: "12345678", DisplayName: "u",
	}, "")

	if w.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403, body=%s", w.Code, w.Body.String())
	}
	env := decode(t, w.Body.Bytes())
	if env.Error == nil || env.Error.Code != httpx.CodeForbidden {
		t.Fatalf("err = %+v", env.Error)
	}
	if env.Error.Message != "当前站点已关闭注册，请联系管理员" {
		t.Fatalf("message = %q", env.Error.Message)
	}
	if exists, _ := r.users.EmailExists(context.Background(), "closed@x.com"); exists {
		t.Fatalf("disabled registration created a user")
	}
	if len(r.refresh.rows) != 0 {
		t.Fatalf("disabled registration issued refresh tokens")
	}
}

func TestHandler_Register_422_Validation(t *testing.T) {
	r := newRig(t)
	w := r.do(t, http.MethodPost, "/api/v1/auth/register", auth.RegisterReq{
		Email: "not-an-email", Password: "short", DisplayName: "",
	}, "")
	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422", w.Code)
	}
	env := decode(t, w.Body.Bytes())
	if env.Error == nil || env.Error.Code != httpx.CodeValidationFailed {
		t.Fatalf("err = %+v", env.Error)
	}
	if len(env.Error.Fields) == 0 {
		t.Fatalf("expected fields map, got %+v", env.Error)
	}
}

func TestHandler_Login_401_WrongPassword(t *testing.T) {
	r := newRig(t)
	_ = registerOK(t, r, "a@b.com", "rightpass")

	w := r.do(t, http.MethodPost, "/api/v1/auth/login", auth.LoginReq{
		Email: "a@b.com", Password: "wrongpass",
	}, "")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", w.Code)
	}
	env := decode(t, w.Body.Bytes())
	if env.Error == nil || env.Error.Code != httpx.CodeUnauthorized {
		t.Fatalf("err = %+v", env.Error)
	}
}

func TestHandler_Login_403_Disabled(t *testing.T) {
	r := newRig(t)
	_ = registerOK(t, r, "d@x.com", "12345678")
	r.users.byID[1].Disabled = true

	w := r.do(t, http.MethodPost, "/api/v1/auth/login", auth.LoginReq{
		Email: "d@x.com", Password: "12345678",
	}, "")
	if w.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", w.Code)
	}
	env := decode(t, w.Body.Bytes())
	if env.Error == nil || env.Error.Code != httpx.CodeAccountDisabled {
		t.Fatalf("err = %+v", env.Error)
	}
}

func TestHandler_Login_200_WhenRegistrationDisabled(t *testing.T) {
	r := newRig(t)
	_ = registerOK(t, r, "existing@x.com", "12345678")
	r.policy.enabled = false

	w := r.do(t, http.MethodPost, "/api/v1/auth/login", auth.LoginReq{
		Email: "existing@x.com", Password: "12345678",
	}, "")

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200, body=%s", w.Code, w.Body.String())
	}
}

func TestHandler_Me_200(t *testing.T) {
	r := newRig(t)
	resp := registerOK(t, r, "a@b.com", "12345678")

	w := r.do(t, http.MethodGet, "/api/v1/auth/me", nil, resp.Tokens.AccessToken)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", w.Code, w.Body.String())
	}
}

func TestHandler_Me_401_NoBearer(t *testing.T) {
	r := newRig(t)
	w := r.do(t, http.MethodGet, "/api/v1/auth/me", nil, "")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", w.Code)
	}
}

func TestHandler_Refresh_RotatesPair(t *testing.T) {
	r := newRig(t)
	_, cookie := registerOKWithCookie(t, r, "a@b.com", "12345678")

	w := r.doWithCookies(t, http.MethodPost, "/api/v1/auth/refresh", nil, "", cookie)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", w.Code, w.Body.String())
	}
	var env struct {
		Data struct {
			Tokens auth.TokenPair `json:"tokens"`
		} `json:"data"`
		Error any `json:"error"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("decode refresh: %v", err)
	}
	if env.Data.Tokens.AccessToken == "" {
		t.Fatalf("refresh response missing access token")
	}
	if env.Data.Tokens.RefreshToken != "" {
		t.Fatalf("refresh token should not be returned in JSON")
	}
	nextCookie := refreshCookieFrom(t, w)
	if nextCookie.Value == "" || nextCookie.Value == cookie.Value {
		t.Fatalf("refresh cookie was not rotated")
	}
	// old token should be unusable
	w2 := r.doWithCookies(t, http.MethodPost, "/api/v1/auth/refresh", nil, "", cookie)
	if w2.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 on reused refresh, got %d", w2.Code)
	}
}

func TestHandler_Refresh_LegacyBodyStillWorks(t *testing.T) {
	r := newRig(t)
	_, cookie := registerOKWithCookie(t, r, "legacy@b.com", "12345678")

	w := r.do(t, http.MethodPost, "/api/v1/auth/refresh", auth.RefreshReq{
		RefreshToken: cookie.Value,
	}, "")

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", w.Code, w.Body.String())
	}
}

func TestHandler_ChangePassword_RevokesRefreshAndInvalidatesOldPw(t *testing.T) {
	r := newRig(t)
	resp, cookie := registerOKWithCookie(t, r, "a@b.com", "12345678")

	w := r.do(t, http.MethodPost, "/api/v1/auth/password", auth.ChangePasswordReq{
		OldPassword: "12345678", NewPassword: "newpassw0rd",
	}, resp.Tokens.AccessToken)
	if w.Code != http.StatusOK {
		t.Fatalf("change pwd: status=%d body=%s", w.Code, w.Body.String())
	}
	cleared := refreshCookieFrom(t, w)
	if cleared.MaxAge >= 0 {
		t.Fatalf("change password should clear refresh cookie, maxAge=%d", cleared.MaxAge)
	}

	// old refresh revoked
	w2 := r.doWithCookies(t, http.MethodPost, "/api/v1/auth/refresh", nil, "", cookie)
	if w2.Code != http.StatusUnauthorized {
		t.Fatalf("old refresh should be 401, got %d", w2.Code)
	}

	// old password rejected
	w3 := r.do(t, http.MethodPost, "/api/v1/auth/login", auth.LoginReq{
		Email: "a@b.com", Password: "12345678",
	}, "")
	if w3.Code != http.StatusUnauthorized {
		t.Fatalf("old pw should be 401, got %d", w3.Code)
	}
}

func TestHandler_Logout_RevokesToken(t *testing.T) {
	r := newRig(t)
	_, cookie := registerOKWithCookie(t, r, "a@b.com", "12345678")

	w := r.doWithCookies(t, http.MethodPost, "/api/v1/auth/logout", nil, "", cookie)
	if w.Code != http.StatusOK {
		t.Fatalf("logout: status=%d body=%s", w.Code, w.Body.String())
	}
	cleared := refreshCookieFrom(t, w)
	if cleared.MaxAge >= 0 {
		t.Fatalf("logout should clear refresh cookie, maxAge=%d", cleared.MaxAge)
	}
	w2 := r.doWithCookies(t, http.MethodPost, "/api/v1/auth/refresh", nil, "", cookie)
	if w2.Code != http.StatusUnauthorized {
		t.Fatalf("after logout, refresh should be 401, got %d", w2.Code)
	}
}

func TestHandler_RequireAuth_BadBearer(t *testing.T) {
	r := newRig(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	req.Header.Set("Authorization", "NotBearer xxx") // wrong scheme
	w := httptest.NewRecorder()
	r.engine.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", w.Code)
	}
}

func TestHandler_RequireAuth_InvalidToken(t *testing.T) {
	r := newRig(t)
	w := r.do(t, http.MethodGet, "/api/v1/auth/me", nil, "obvious-garbage-not-a-jwt")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", w.Code)
	}
}

func TestHandler_RequireAuth_DisabledAfterIssue(t *testing.T) {
	r := newRig(t)
	resp := registerOK(t, r, "a@b.com", "12345678")
	// flip disabled after token issued
	r.users.byID[1].Disabled = true

	w := r.do(t, http.MethodGet, "/api/v1/auth/me", nil, resp.Tokens.AccessToken)
	if w.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403 (account_disabled)", w.Code)
	}
	env := decode(t, w.Body.Bytes())
	if env.Error == nil || env.Error.Code != httpx.CodeAccountDisabled {
		t.Fatalf("err = %+v", env.Error)
	}
}

func TestHandler_Refresh_422_MissingBody(t *testing.T) {
	r := newRig(t)
	w := r.do(t, http.MethodPost, "/api/v1/auth/refresh", auth.RefreshReq{}, "")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", w.Code)
	}
}

// TestHandler_RateLimit_429 mirrors main.go's wiring (limit 5/min/IP on
// /auth/login) and asserts the 6th request returns 429 + rate_limited code
// with a Retry-After header. Acceptance criterion A4 calls for 429 coverage
// in handler integration tests.
func TestHandler_RateLimit_429(t *testing.T) {
	r := newRig(t)

	// Re-mount /auth/login behind a 2/min/IP limiter so this test stays fast.
	engine := gin.New()
	engine.Use(httpx.Recovery())
	v1 := engine.Group("/api/v1")
	v1.POST("/auth/login",
		httpx.RateLimit(2, time.Minute, httpx.KeyByIP),
		r.handler.LoginEndpoint,
	)

	hit := func() *httptest.ResponseRecorder {
		body, _ := json.Marshal(auth.LoginReq{Email: "noone@x.com", Password: "whatever1"})
		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		engine.ServeHTTP(w, req)
		return w
	}

	// First two are allowed (will return 401 because user doesn't exist).
	if w := hit(); w.Code != http.StatusUnauthorized {
		t.Fatalf("request 1: want 401, got %d", w.Code)
	}
	if w := hit(); w.Code != http.StatusUnauthorized {
		t.Fatalf("request 2: want 401, got %d", w.Code)
	}
	// Third hits the limiter.
	w := hit()
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("request 3: want 429, got %d body=%s", w.Code, w.Body.String())
	}
	if w.Header().Get("Retry-After") == "" {
		t.Fatalf("expected Retry-After header on 429")
	}
	env := decode(t, w.Body.Bytes())
	if env.Error == nil || env.Error.Code != httpx.CodeRateLimited {
		t.Fatalf("want rate_limited code, got %+v", env.Error)
	}
}
