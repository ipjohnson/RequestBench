package implementation

import (
	"bytes"
	"crypto/sha1"
	"encoding/hex"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// etagRoutes answer like any other. Gin computes no validator for an answer, and net/http under
// it computes none for anything but a file, so the /etag group carries a middleware written for
// it. The body is built and hashed before anything is compared, so a 304 saves the write and
// nothing else.
func etagRoutes(r *gin.Engine, p *Payloads) {
	// rb:wiring etag.*
	etag := r.Group("/etag", revalidate)

	// rb:handler etag.small
	etag.GET("/small", fresh(&p.Small))

	// rb:handler etag.large,etag.match_large,etag.stale_large
	etag.GET("/large", fresh(&p.Large))
}

// rb:wiring etag.*
// revalidate holds back what the handler writes, hashes it with SHA-1, and answers 304 when
// If-None-Match already names the hash.
func revalidate(c *gin.Context) {
	held := &heldWriter{ResponseWriter: c.Writer, status: http.StatusOK}
	c.Writer = held
	c.Next()
	c.Writer = held.ResponseWriter

	sum := sha1.Sum(held.body.Bytes())
	tag := `"` + hex.EncodeToString(sum[:]) + `"`
	c.Header("ETag", tag)
	if names(c.GetHeader("If-None-Match"), tag) {
		c.Writer.Header().Del("Content-Type")
		c.Status(http.StatusNotModified)
		return
	}
	c.Status(held.status)
	_, _ = c.Writer.Write(held.body.Bytes())
}

// names compares each tag in an If-None-Match list weakly, as RFC 9110 has a GET compared.
func names(ifNoneMatch, tag string) bool {
	for candidate := range strings.SplitSeq(ifNoneMatch, ",") {
		candidate = strings.TrimPrefix(strings.TrimSpace(candidate), "W/")
		if candidate == tag || candidate == "*" {
			return true
		}
	}
	return false
}

// heldWriter keeps the status and the body a handler writes instead of sending them. Swapping
// c.Writer is how a gin middleware gets at an answer before it goes out.
type heldWriter struct {
	gin.ResponseWriter
	status int
	body   bytes.Buffer
}

func (w *heldWriter) WriteHeader(status int) { w.status = status }

func (w *heldWriter) WriteHeaderNow() {}

func (w *heldWriter) Write(data []byte) (int, error) { return w.body.Write(data) }

func (w *heldWriter) WriteString(data string) (int, error) { return w.body.WriteString(data) }

func (w *heldWriter) Status() int { return w.status }

func (w *heldWriter) Written() bool { return w.body.Len() > 0 }

// rb:end
