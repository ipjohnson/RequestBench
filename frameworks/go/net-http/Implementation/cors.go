package implementation

import (
	"net/http"
	"strconv"
)

// corsRoutes serve /cors/ from a ServeMux of its own, wrapped in the CORS handler, so the policy
// covers /cors and nothing else. net/http has no CORS support, so the wrapper is written for it.
// The handler writes x-rb-serial, so its absence on a preflight shows the wrapper answered alone.
func corsRoutes(mux *http.ServeMux, p *Payloads) {
	crossOrigin := http.NewServeMux()
	crossOrigin.Handle("GET /cors/small", fresh(&p.Small))

	// A pattern that names no method matches every method, so a preflight reaches the wrapper.
	mux.Handle("/cors/", allowCrossOrigin(p.Settings.Cors, crossOrigin))
}

// rb:wiring cors.*
// allowCrossOrigin answers a preflight itself, and lets every other request through to the
// handler. Only an answer to the allowed origin carries the CORS headers.
func allowCrossOrigin(policy CorsSettings, next http.Handler) http.Handler {
	maxAge := strconv.Itoa(policy.MaxAgeSeconds)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := w.Header()
		header.Add("Vary", "Origin")
		allowed := r.Header.Get("Origin") == policy.Origin
		if allowed {
			header.Set("Access-Control-Allow-Origin", policy.Origin)
		}
		if r.Method != http.MethodOptions || r.Header.Get("Access-Control-Request-Method") == "" {
			next.ServeHTTP(w, r)
			return
		}
		if allowed {
			header.Set("Access-Control-Allow-Methods", policy.Method)
			header.Set("Access-Control-Allow-Headers", policy.Header)
			header.Set("Access-Control-Max-Age", maxAge)
		}
		w.WriteHeader(http.StatusNoContent)
	})
}

// rb:end
