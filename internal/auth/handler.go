package auth

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/liusx/shadraw/internal/httpx"
	"github.com/liusx/shadraw/internal/user"
)

const refreshCookieName = "shadraw_refresh"

// Handler bundles the auth HTTP endpoints.
type Handler struct {
	svc                *Service
	registrationPolicy registrationPolicyReader
}

type registrationPolicyReader interface {
	RegistrationEnabled() bool
}

func NewHandler(svc *Service, registrationPolicy ...registrationPolicyReader) *Handler {
	h := &Handler{svc: svc}
	if len(registrationPolicy) > 0 {
		h.registrationPolicy = registrationPolicy[0]
	}
	return h
}

// Exported handlers — main wires each route individually so it can attach
// per-route middleware (rate limit, require auth) as the spec dictates.
func (h *Handler) RegisterEndpoint(c *gin.Context)       { h.register(c) }
func (h *Handler) LoginEndpoint(c *gin.Context)          { h.login(c) }
func (h *Handler) RefreshEndpoint(c *gin.Context)        { h.refresh(c) }
func (h *Handler) LogoutEndpoint(c *gin.Context)         { h.logout(c) }
func (h *Handler) MeEndpoint(c *gin.Context)             { h.me(c) }
func (h *Handler) ChangePasswordEndpoint(c *gin.Context) { h.changePassword(c) }

func (h *Handler) register(c *gin.Context) {
	var req RegisterReq
	if !httpx.BindJSON(c, &req) {
		return
	}
	if h.registrationPolicy != nil && !h.registrationPolicy.RegistrationEnabled() {
		httpx.Fail(c, http.StatusForbidden, httpx.CodeForbidden, "当前站点已关闭注册，请联系管理员")
		return
	}
	resp, err := h.svc.Register(c.Request.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrEmailTaken):
			httpx.Fail(c, http.StatusConflict, httpx.CodeConflict, "邮箱已被注册")
		default:
			httpx.Fail(c, http.StatusInternalServerError, httpx.CodeInternalError, "internal error")
		}
		return
	}
	setRefreshCookie(c, resp.Tokens.RefreshToken)
	resp.Tokens.RefreshToken = ""
	httpx.Created(c, resp)
}

func (h *Handler) login(c *gin.Context) {
	var req LoginReq
	if !httpx.BindJSON(c, &req) {
		return
	}
	resp, err := h.svc.Login(c.Request.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidCredentials):
			httpx.Fail(c, http.StatusUnauthorized, httpx.CodeUnauthorized, "邮箱或密码错误")
		case errors.Is(err, ErrUserDisabled):
			httpx.Fail(c, http.StatusForbidden, httpx.CodeAccountDisabled, "账号已禁用")
		default:
			httpx.Fail(c, http.StatusInternalServerError, httpx.CodeInternalError, "internal error")
		}
		return
	}
	setRefreshCookie(c, resp.Tokens.RefreshToken)
	resp.Tokens.RefreshToken = ""
	httpx.OK(c, resp)
}

func (h *Handler) refresh(c *gin.Context) {
	var req RefreshReq
	if c.Request.Body != nil && c.Request.ContentLength != 0 {
		if !httpx.BindJSON(c, &req) {
			return
		}
	}
	raw := req.RefreshToken
	if raw == "" {
		raw = refreshCookie(c)
	}
	if raw == "" {
		clearRefreshCookie(c)
		httpx.Fail(c, http.StatusUnauthorized, httpx.CodeUnauthorized, "refresh token 无效")
		return
	}
	pair, err := h.svc.Refresh(c.Request.Context(), raw)
	if err != nil {
		switch {
		case errors.Is(err, ErrRefreshInvalid),
			errors.Is(err, ErrRefreshExpired),
			errors.Is(err, ErrRefreshRevoked):
			clearRefreshCookie(c)
			httpx.Fail(c, http.StatusUnauthorized, httpx.CodeUnauthorized, "refresh token 无效")
		case errors.Is(err, ErrUserDisabled):
			clearRefreshCookie(c)
			httpx.Fail(c, http.StatusForbidden, httpx.CodeAccountDisabled, "账号已禁用")
		default:
			httpx.Fail(c, http.StatusInternalServerError, httpx.CodeInternalError, "internal error")
		}
		return
	}
	setRefreshCookie(c, pair.RefreshToken)
	pair.RefreshToken = ""
	httpx.OK(c, gin.H{"tokens": pair})
}

func (h *Handler) logout(c *gin.Context) {
	var req LogoutReq
	if c.Request.Body != nil && c.Request.ContentLength != 0 {
		if !httpx.BindJSON(c, &req) {
			return
		}
	}
	raw := req.RefreshToken
	if raw == "" {
		raw = refreshCookie(c)
	}
	if raw != "" {
		if err := h.svc.Logout(c.Request.Context(), raw); err != nil {
			httpx.Fail(c, http.StatusInternalServerError, httpx.CodeInternalError, "internal error")
			return
		}
	}
	clearRefreshCookie(c)
	httpx.OK(c, gin.H{"ok": true})
}

func setRefreshCookie(c *gin.Context, raw string) {
	if raw == "" {
		return
	}
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     refreshCookieName,
		Value:    raw,
		Path:     "/api/v1/auth",
		MaxAge:   int(RefreshTTL.Seconds()),
		HttpOnly: true,
		Secure:   isHTTPS(c),
		SameSite: http.SameSiteLaxMode,
	})
}

func clearRefreshCookie(c *gin.Context) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     refreshCookieName,
		Value:    "",
		Path:     "/api/v1/auth",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   isHTTPS(c),
		SameSite: http.SameSiteLaxMode,
	})
}

func refreshCookie(c *gin.Context) string {
	cookie, err := c.Request.Cookie(refreshCookieName)
	if err != nil {
		return ""
	}
	return cookie.Value
}

func isHTTPS(c *gin.Context) bool {
	if c.Request.TLS != nil {
		return true
	}
	if c.GetHeader("X-Forwarded-Proto") == "https" {
		return true
	}
	if c.GetHeader("X-Forwarded-Ssl") == "on" {
		return true
	}
	return false
}

func (h *Handler) me(c *gin.Context) {
	uid, err := strconv.ParseInt(httpx.UserIDFrom(c), 10, 64)
	if err != nil {
		httpx.Fail(c, http.StatusUnauthorized, httpx.CodeUnauthorized, "无效会话")
		return
	}
	u, err := h.svc.Me(c.Request.Context(), uid)
	if err != nil {
		if errors.Is(err, user.ErrNotFound) {
			httpx.Fail(c, http.StatusUnauthorized, httpx.CodeUnauthorized, "用户不存在")
			return
		}
		httpx.Fail(c, http.StatusInternalServerError, httpx.CodeInternalError, "internal error")
		return
	}
	httpx.OK(c, gin.H{"user": ToUserDTO(u)})
}

func (h *Handler) changePassword(c *gin.Context) {
	var req ChangePasswordReq
	if !httpx.BindJSON(c, &req) {
		return
	}
	uid, err := strconv.ParseInt(httpx.UserIDFrom(c), 10, 64)
	if err != nil {
		httpx.Fail(c, http.StatusUnauthorized, httpx.CodeUnauthorized, "无效会话")
		return
	}
	if err := h.svc.ChangePassword(c.Request.Context(), uid, req.OldPassword, req.NewPassword); err != nil {
		switch {
		case errors.Is(err, ErrInvalidCredentials):
			httpx.Fail(c, http.StatusUnauthorized, httpx.CodeUnauthorized, "旧密码错误")
		default:
			httpx.Fail(c, http.StatusInternalServerError, httpx.CodeInternalError, "internal error")
		}
		return
	}
	clearRefreshCookie(c)
	httpx.OK(c, gin.H{"ok": true})
}
