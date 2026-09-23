package implementation

import (
	"bytes"
	"crypto/sha1"
	"encoding/hex"
	"net/http"
	"strings"

	"github.com/labstack/echo/v5"
)

// etagRoutes answer like any other. Echo computes no validator for an answer, and net/http under
// it computes none for anything but a file, so these routes carry a middleware written for it.
// The body is built and hashed before anything is compared, so a 304 saves the write and
// nothing else.
func etagRoutes(e *echo.Echo, p *Payloads) {
	e.GET("/etag/small", fresh(&p.Small), revalidate)

	e.GET("/etag/large", fresh(&p.Large), revalidate)
}

// rb:wiring etag.*
// revalidate holds back what the handler writes, hashes it with SHA-1, and answers 304 when
// If-None-Match already names the hash.
func revalidate(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c *echo.Context) error {
		original := c.Response()
		held := &heldWriter{ResponseWriter: original, status: http.StatusOK}
		c.SetResponse(held)
		err := next(c)
		c.SetResponse(original)
		if err != nil {
			return err
		}

		sum := sha1.Sum(held.body.Bytes())
		tag := `"` + hex.EncodeToString(sum[:]) + `"`
		original.Header().Set("ETag", tag)
		if names(c.Request().Header.Get("If-None-Match"), tag) {
			original.Header().Del(echo.HeaderContentType)
			original.WriteHeader(http.StatusNotModified)
			return nil
		}
		original.WriteHeader(held.status)
		_, err = original.Write(held.body.Bytes())
		return err
	}
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

// heldWriter keeps the status and the body a handler writes instead of sending them. The headers
// go to the real writer's map, so they are sent with whatever revalidate answers. Unwrap is how
// Echo finds its own Response under a writer a middleware installs.
type heldWriter struct {
	http.ResponseWriter
	status int
	body   bytes.Buffer
}

func (w *heldWriter) WriteHeader(status int) { w.status = status }

func (w *heldWriter) Write(data []byte) (int, error) { return w.body.Write(data) }

func (w *heldWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

// rb:end
