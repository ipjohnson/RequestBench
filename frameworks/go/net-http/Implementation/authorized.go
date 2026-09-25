package implementation

import "net/http"

// authorizedRoutes wrap the route's handler in one that refuses any bearer token but
// settings.json's. net/http has nothing for a bearer token, so the wrapper is the application's.
func authorizedRoutes(mux *http.ServeMux, p *Payloads) {
	mux.Handle("GET /authorized/small", requireToken(p.Settings.Token, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		respond(w, http.StatusOK, &p.Small)
	})))
}

// rb:wiring authorized.*
// requireToken refuses any other Authorization with http.Error and 403, and hands the rest on.
func requireToken(token string, next http.Handler) http.Handler {
	expected := "Bearer " + token
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != expected {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}
