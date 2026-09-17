// compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
//
// chi's own compress middleware, attached to these three routes alone. On the router it
// would put a "did the client ask?" check on all forty-five endpoints and contaminate the
// rows this family is measured against, which is why they have their own paths instead of
// riding on /json with an accept-encoding header.
package main

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// Level is pinned across every language. chi compresses whatever it is given, with no size
// floor of its own, which is one of the things compressed.gzip_small is in the set to show.
// rb:wiring compressed.*
var gzip = chimw.Compress(d.GzipLevel, "application/json")

// rb:wiring compressed.*
func compressedRoute(size string) http.HandlerFunc {
	body := d.Payload(size)
	return func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("x-rb-serial", d.NextSerial())
		writeJSON(w, 200, body)
	}
}

func registerCompressed(r chi.Router) {
	// rb:handler compressed.*
	for _, size := range []string{"small", "medium", "large"} {
		r.With(gzip).Get("/compressed/"+size, compressedRoute(size))
	}
}
