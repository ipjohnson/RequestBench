package implementation

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

// HeadersBound is the three headers /headers/bind reads.
type HeadersBound struct {
	Tenant    string `json:"tenant"`
	RequestID string `json:"requestId"`
	Account   int    `json:"account"`
}

// headersRoutes: /headers reads no header, and /headers/bind reads three from net/http's
// header map, converting the account to an integer.
func headersRoutes(r chi.Router, p *Payloads) {
	r.Get("/headers", func(w http.ResponseWriter, r *http.Request) { render.JSON(w, r, &p.Small) })

	r.Get("/headers/bind", func(w http.ResponseWriter, r *http.Request) {
		account, err := strconv.Atoi(r.Header.Get("X-Rb-Account"))
		if err != nil {
			refuse(w, r, err)
			return
		}
		bound := HeadersBound{
			Tenant:    r.Header.Get("X-Rb-Tenant"),
			RequestID: r.Header.Get("X-Rb-Request-Id"),
			Account:   account,
		}
		render.JSON(w, r, Echoed[HeadersBound]{&p.Small, bound})
	})
}
