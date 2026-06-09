package auth

import (
	"bytes"
	"errors"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/liusx/shadraw/internal/blob"
	"github.com/liusx/shadraw/internal/httpx"
	"github.com/liusx/shadraw/internal/user"
)

const refreshCookieName = "shadraw_refresh"
const maxAvatarBytes = 2 * 1024 * 1024

// Handler bundles the auth HTTP endpoints.
type Handler struct {
	svc                *Service
	registrationPolicy registrationPolicyReader
	blob               blob.Store
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

// WithBlobStore attaches binary storage for account avatar endpoints.
func (h *Handler) WithBlobStore(store blob.Store) *Handler {
	h.blob = store
	return h
}

// Exported handlers — main wires each route individually so it can attach
// per-route middleware (rate limit, require auth) as the spec dictates.
func (h *Handler) RegisterEndpoint(c *gin.Context)       { h.register(c) }
func (h *Handler) LoginEndpoint(c *gin.Context)          { h.login(c) }
func (h *Handler) RefreshEndpoint(c *gin.Context)        { h.refresh(c) }
func (h *Handler) LogoutEndpoint(c *gin.Context)         { h.logout(c) }
func (h *Handler) MeEndpoint(c *gin.Context)             { h.me(c) }
func (h *Handler) UpdateProfileEndpoint(c *gin.Context)  { h.updateProfile(c) }
func (h *Handler) UploadAvatarEndpoint(c *gin.Context)   { h.uploadAvatar(c) }
func (h *Handler) DeleteAvatarEndpoint(c *gin.Context)   { h.deleteAvatar(c) }
func (h *Handler) StreamAvatarEndpoint(c *gin.Context)   { h.streamAvatar(c) }
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

func (h *Handler) updateProfile(c *gin.Context) {
	var req UpdateProfileReq
	if !httpx.BindJSON(c, &req) {
		return
	}
	req.DisplayName = strings.TrimSpace(req.DisplayName)
	if req.DisplayName == "" || len([]rune(req.DisplayName)) > 32 {
		httpx.Fail(c, http.StatusUnprocessableEntity, httpx.CodeValidationFailed, "昵称长度需为 1-32 个字符")
		return
	}
	uid, ok := currentUserID(c)
	if !ok {
		return
	}
	u, err := h.svc.UpdateProfile(c.Request.Context(), uid, req)
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

func (h *Handler) uploadAvatar(c *gin.Context) {
	if h.blob == nil {
		httpx.Fail(c, http.StatusInternalServerError, httpx.CodeInternalError, "avatar storage unavailable")
		return
	}
	uid, ok := currentUserID(c)
	if !ok {
		return
	}
	file, err := c.FormFile("avatar")
	if err != nil {
		httpx.Fail(c, http.StatusUnprocessableEntity, httpx.CodeValidationFailed, "请选择头像文件")
		return
	}
	if file.Size <= 0 || file.Size > maxAvatarBytes {
		httpx.Fail(c, http.StatusUnprocessableEntity, httpx.CodeValidationFailed, "头像不能超过 2MB")
		return
	}
	f, err := file.Open()
	if err != nil {
		httpx.Fail(c, http.StatusInternalServerError, httpx.CodeInternalError, "internal error")
		return
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, maxAvatarBytes+1))
	if err != nil {
		httpx.Fail(c, http.StatusInternalServerError, httpx.CodeInternalError, "internal error")
		return
	}
	if len(data) > maxAvatarBytes {
		httpx.Fail(c, http.StatusUnprocessableEntity, httpx.CodeValidationFailed, "头像不能超过 2MB")
		return
	}
	ext, ok := avatarExt(data)
	if !ok {
		httpx.Fail(c, http.StatusUnprocessableEntity, httpx.CodeValidationFailed, "头像仅支持 JPG 或 PNG")
		return
	}
	userKey := "user-" + strconv.FormatInt(uid, 10)
	fileKey := "avatar-" + strconv.FormatInt(time.Now().UnixNano(), 10) + ext
	path, err := h.blob.Put(c.Request.Context(), "avatars", userKey, fileKey, data)
	if err != nil {
		httpx.Fail(c, http.StatusInternalServerError, httpx.CodeInternalError, "internal error")
		return
	}
	oldPath, u, err := h.svc.UpdateAvatarPath(c.Request.Context(), uid, &path)
	if err != nil {
		_ = h.blob.Delete(c.Request.Context(), path)
		if errors.Is(err, user.ErrNotFound) {
			httpx.Fail(c, http.StatusUnauthorized, httpx.CodeUnauthorized, "用户不存在")
			return
		}
		httpx.Fail(c, http.StatusInternalServerError, httpx.CodeInternalError, "internal error")
		return
	}
	if oldPath != nil && *oldPath != "" && *oldPath != path {
		_ = h.blob.Delete(c.Request.Context(), *oldPath)
	}
	httpx.OK(c, gin.H{"user": ToUserDTO(u)})
}

func (h *Handler) deleteAvatar(c *gin.Context) {
	uid, ok := currentUserID(c)
	if !ok {
		return
	}
	oldPath, u, err := h.svc.UpdateAvatarPath(c.Request.Context(), uid, nil)
	if err != nil {
		if errors.Is(err, user.ErrNotFound) {
			httpx.Fail(c, http.StatusUnauthorized, httpx.CodeUnauthorized, "用户不存在")
			return
		}
		httpx.Fail(c, http.StatusInternalServerError, httpx.CodeInternalError, "internal error")
		return
	}
	if h.blob != nil && oldPath != nil && *oldPath != "" {
		_ = h.blob.Delete(c.Request.Context(), *oldPath)
	}
	httpx.OK(c, gin.H{"user": ToUserDTO(u)})
}

func (h *Handler) streamAvatar(c *gin.Context) {
	if h.blob == nil {
		httpx.Fail(c, http.StatusNotFound, httpx.CodeNotFound, "avatar not found")
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		httpx.Fail(c, http.StatusNotFound, httpx.CodeNotFound, "avatar not found")
		return
	}
	u, err := h.svc.Me(c.Request.Context(), id)
	if err != nil {
		httpx.Fail(c, http.StatusNotFound, httpx.CodeNotFound, "avatar not found")
		return
	}
	if u.AvatarPath == nil || *u.AvatarPath == "" {
		httpx.Fail(c, http.StatusNotFound, httpx.CodeNotFound, "avatar not found")
		return
	}
	var buf bytes.Buffer
	if err := h.blob.Get(c.Request.Context(), *u.AvatarPath, &buf); err != nil {
		httpx.Fail(c, http.StatusNotFound, httpx.CodeNotFound, "avatar not found")
		return
	}
	mime := avatarMIME(*u.AvatarPath, buf.Bytes())
	c.Header("Content-Type", mime)
	c.Header("Cache-Control", "private, max-age=86400")
	c.Data(http.StatusOK, mime, buf.Bytes())
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

func currentUserID(c *gin.Context) (int64, bool) {
	uid, err := strconv.ParseInt(httpx.UserIDFrom(c), 10, 64)
	if err != nil {
		httpx.Fail(c, http.StatusUnauthorized, httpx.CodeUnauthorized, "无效会话")
		return 0, false
	}
	return uid, true
}

func avatarExt(data []byte) (string, bool) {
	mime := http.DetectContentType(data)
	switch mime {
	case "image/png":
		return ".png", true
	case "image/jpeg":
		return ".jpg", true
	default:
		return "", false
	}
}

func avatarMIME(path string, data []byte) string {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	default:
		return http.DetectContentType(data)
	}
}
