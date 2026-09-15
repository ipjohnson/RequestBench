// cached: validator headers and the conditional request.
//
// The ETag is pinned in the fixture, so this measures emitting the header and comparing it
// rather than hashing the body. The size is closed over rather than read back out of the
// path, and the comparison requires a non-empty header: matching a missing if-none-match
// against an empty ETag answers 304 to a client that never asked a conditional question.
package main

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

func validatorsFor(size string) func(http.Handler) http.Handler {
	etag := d.ETagOf(size)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			h := w.Header()
			h.Set("etag", etag)
			h.Set("cache-control", d.Cacheable)
			h.Set("x-rb-serial", d.NextSerial())
			if inm := req.Header.Get("if-none-match"); inm != "" && inm == etag {
				w.WriteHeader(304)
				return
			}
			next.ServeHTTP(w, req)
		})
	}
}

func registerCached(r chi.Router) {
	// rb:snippet cached.small cached.medium cached.large cached.revalidate
	for _, size := range []string{"small", "medium", "large"} {
		r.With(validatorsFor(size)).Get("/cached/"+size, payload(size))
	}
}
