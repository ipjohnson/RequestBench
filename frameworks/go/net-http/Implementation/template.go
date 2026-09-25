package implementation

import (
	"embed"
	"html/template"
	"net/http"
)

// rb:wiring template.*

//go:embed views/items.tmpl
var views embed.FS

// templateRoutes render the payload with html/template, executed into the response. The template
// is compiled into the binary and parsed once.
func templateRoutes(mux *http.ServeMux, p *Payloads) {
	// rb:wiring template.*
	page := template.Must(template.ParseFS(views, "views/items.tmpl"))
	rendered := func(payload *Payload) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_ = page.Execute(w, payload)
		}
	}
	// rb:end

	mux.HandleFunc("GET /template/small", rendered(&p.Small))

	mux.HandleFunc("GET /template/medium", rendered(&p.Medium))
}
