package implementation

import (
	"net/http"

	"github.com/gorilla/mux"
)

// jsonRoutes serialise a payload the framework already holds, at three sizes, with
// encoding/json's encoder.
func jsonRoutes(r *mux.Router, p *Payloads) {
	r.HandleFunc("/json/small", func(w http.ResponseWriter, r *http.Request) { respond(w, http.StatusOK, &p.Small) }).Methods(http.MethodGet)

	r.HandleFunc("/json/medium", func(w http.ResponseWriter, r *http.Request) { respond(w, http.StatusOK, &p.Medium) }).Methods(http.MethodGet)

	r.HandleFunc("/json/large", func(w http.ResponseWriter, r *http.Request) { respond(w, http.StatusOK, &p.Large) }).Methods(http.MethodGet)
}
