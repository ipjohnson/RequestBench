package implementation

import (
	"net/http"
	"strconv"
)

// HeadersBound is the three headers /headers/bind reads.
type HeadersBound struct {
	Tenant    string `json:"tenant"`
	RequestID string `json:"requestId"`
	Account   int    `json:"account"`
}

// headersRoutes: /headers reads no header, and /headers/bind reads three from net/http's header
// map, converting the account to an integer.
func headersRoutes(mux *http.ServeMux, p *Payloads) {
	mux.HandleFunc("GET /headers", func(w http.ResponseWriter, r *http.Request) { respond(w, http.StatusOK, &p.Small) })

	mux.HandleFunc("GET /headers/bind", func(w http.ResponseWriter, r *http.Request) {
		account, err := strconv.Atoi(r.Header.Get("X-Rb-Account"))
		if err != nil {
			refuse(w, err)
			return
		}
		bound := HeadersBound{
			Tenant:    r.Header.Get("X-Rb-Tenant"),
			RequestID: r.Header.Get("X-Rb-Request-Id"),
			Account:   account,
		}
		respond(w, http.StatusOK, Echoed[HeadersBound]{&p.Small, bound})
	})
}
