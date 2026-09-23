package implementation

import (
	"embed"
	"html/template"
	"net/http"

	"github.com/go-chi/chi/v5"
)

// rb:wiring template.*

//go:embed views/items.tmpl
var views embed.FS

// templateRoutes render the payload with html/template. chi has no view layer, and render
// writes only a string it is handed as HTML, so the handler executes the template into the
// response. The template is compiled into the binary and parsed once.
func templateRoutes(r chi.Router, p *Payloads) {
	// rb:wiring template.*
	page := template.Must(template.ParseFS(views, "views/items.tmpl"))
	rendered := func(payload *Payload) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_ = page.Execute(w, payload)
		}
	}
	// rb:end

	r.Get("/template/small", rendered(&p.Small))

	r.Get("/template/medium", rendered(&p.Medium))
}
