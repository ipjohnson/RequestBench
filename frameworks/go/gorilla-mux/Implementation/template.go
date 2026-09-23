package implementation

import (
	"embed"
	"html/template"
	"net/http"

	"github.com/gorilla/mux"
)

// rb:wiring template.*

//go:embed views/items.tmpl
var views embed.FS

// templateRoutes render the payload with html/template, executed into the response, because
// mux has no view layer. The template is compiled into the binary and parsed once.
func templateRoutes(r *mux.Router, p *Payloads) {
	// rb:wiring template.*
	page := template.Must(template.ParseFS(views, "views/items.tmpl"))
	rendered := func(payload *Payload) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_ = page.Execute(w, payload)
		}
	}
	// rb:end

	r.HandleFunc("/template/small", rendered(&p.Small)).Methods(http.MethodGet)

	r.HandleFunc("/template/medium", rendered(&p.Medium)).Methods(http.MethodGet)
}
