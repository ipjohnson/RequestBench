package implementation

import (
	"bytes"
	"crypto/sha1"
	"encoding/hex"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
)

// etagRoutes answer like any other. chi computes no validator for an answer, and net/http under
// it computes none for anything but a file, so these routes carry a middleware written for it.
// The body is built and hashed before anything is compared, so a 304 saves the write and
// nothing else.
func etagRoutes(r chi.Router, p *Payloads) {
	r.With(revalidate).Get("/etag/small", fresh(&p.Small))

	r.With(revalidate).Get("/etag/large", fresh(&p.Large))
}

// rb:wiring etag.*
// revalidate holds back what the handler writes, hashes it with SHA-1, and answers 304 when
// If-None-Match already names the hash.
func revalidate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		held := &heldWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(held, r)

		sum := sha1.Sum(held.body.Bytes())
		tag := `"` + hex.EncodeToString(sum[:]) + `"`
		w.Header().Set("ETag", tag)
		if names(r.Header.Get("If-None-Match"), tag) {
			w.Header().Del("Content-Type")
			w.WriteHeader(http.StatusNotModified)
			return
		}
		w.WriteHeader(held.status)
		_, _ = w.Write(held.body.Bytes())
	})
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

// heldWriter keeps the status and the body a handler writes instead of sending them. The
// headers go to the real writer's map, so they are sent with whatever revalidate answers.
type heldWriter struct {
	http.ResponseWriter
	status int
	body   bytes.Buffer
}

func (w *heldWriter) WriteHeader(status int) { w.status = status }

func (w *heldWriter) Write(data []byte) (int, error) { return w.body.Write(data) }

// rb:end
