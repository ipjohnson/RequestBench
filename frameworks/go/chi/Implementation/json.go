package implementation

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

// jsonRoutes serialise a payload the framework already holds, at three sizes. render.JSON
// encodes it with encoding/json into a buffer and writes the buffer.
func jsonRoutes(r chi.Router, p *Payloads) {
	r.Get("/json/small", func(w http.ResponseWriter, r *http.Request) { render.JSON(w, r, &p.Small) })

	r.Get("/json/medium", func(w http.ResponseWriter, r *http.Request) { render.JSON(w, r, &p.Medium) })

	r.Get("/json/large", func(w http.ResponseWriter, r *http.Request) { render.JSON(w, r, &p.Large) })
}
