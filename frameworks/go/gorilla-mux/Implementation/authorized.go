package implementation

import (
	"net/http"

	"github.com/gorilla/mux"
)

// authorizedRoutes put a middleware on a subrouter of /authorized that refuses any bearer token
// but settings.json's. The gorilla toolkit has nothing for a bearer token, so the middleware is
// the application's, written as mux's README writes its authentication middleware.
func authorizedRoutes(r *mux.Router, p *Payloads) {
	authorized := r.PathPrefix("/authorized").Subrouter()
	authorized.Use(requireToken(p.Settings.Token))

	// rb:handler authorized.allowed,authorized.denied
	authorized.HandleFunc("/small", func(w http.ResponseWriter, r *http.Request) { respond(w, http.StatusOK, &p.Small) }).Methods(http.MethodGet)
}

// rb:wiring authorized.*
func requireToken(token string) mux.MiddlewareFunc {
	expected := "Bearer " + token
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("Authorization") != expected {
				http.Error(w, "Forbidden", http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
