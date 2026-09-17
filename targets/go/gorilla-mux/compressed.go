// compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
//
// gorilla/handlers is the gorilla ecosystem's compressor, wrapping these three routes
// alone. On the router it would put a "did the client ask?" check on all forty-five
// endpoints and contaminate the rows this family is measured against, which is why they
// have their own paths instead of riding on /json with an accept-encoding header.
package main

import (
	"net/http"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// Level is pinned across every language. There is no size floor of its own, which is one
// of the things compressed.gzip_small is in the set to show.
// rb:wiring compressed.*
func gzip(next http.Handler) http.Handler {
	return handlers.CompressHandlerLevel(next, d.GzipLevel)
}

// rb:wiring compressed.*
func compressedRoute(size string) http.HandlerFunc {
	body := d.Payload(size)
	return func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("x-rb-serial", d.NextSerial())
		writeJSON(w, 200, body)
	}
}

func registerCompressed(r *mux.Router) {
	// rb:handler compressed.*
	for _, size := range []string{"small", "medium", "large"} {
		r.Handle("/compressed/"+size, chain(compressedRoute(size), gzip)).Methods("GET")
	}
}
