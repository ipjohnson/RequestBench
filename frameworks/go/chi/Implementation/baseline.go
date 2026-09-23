package implementation

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

// baselineRoutes is the dispatch floor, with nothing serialised.
func baselineRoutes(r chi.Router) {
	r.Get("/plaintext", func(w http.ResponseWriter, r *http.Request) { render.PlainText(w, r, "Hello, World!") })
}
