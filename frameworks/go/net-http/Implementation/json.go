package implementation

import "net/http"

// jsonRoutes serialise a payload the framework already holds, at three sizes, with
// encoding/json's encoder.
func jsonRoutes(mux *http.ServeMux, p *Payloads) {
	mux.HandleFunc("GET /json/small", func(w http.ResponseWriter, r *http.Request) { respond(w, http.StatusOK, &p.Small) })

	mux.HandleFunc("GET /json/medium", func(w http.ResponseWriter, r *http.Request) { respond(w, http.StatusOK, &p.Medium) })

	mux.HandleFunc("GET /json/large", func(w http.ResponseWriter, r *http.Request) { respond(w, http.StatusOK, &p.Large) })
}
