package implementation

import (
	"bytes"
	"context"
	"embed"
	"html/template"

	"github.com/danielgtaylor/huma/v2"
)

// rb:wiring template.*

//go:embed views/items.tmpl
var views embed.FS

// templateRoutes render the payload with html/template into a buffer, and answer it as a []byte
// body under text/html, as Huma's HTML response page does. Huma has no view layer. The template
// is compiled into the binary and parsed once.
func templateRoutes(api huma.API, p *Payloads) {
	// rb:wiring template.*
	page := template.Must(template.ParseFS(views, "views/items.tmpl"))
	rendered := func(payload *Payload) func(context.Context, *struct{}) (*TextOutput, error) {
		return func(ctx context.Context, _ *struct{}) (*TextOutput, error) {
			var html bytes.Buffer
			if err := page.Execute(&html, payload); err != nil {
				return nil, huma.Error500InternalServerError("the page does not render", err)
			}
			return &TextOutput{ContentType: "text/html; charset=utf-8", Body: html.Bytes()}, nil
		}
	}
	// rb:end

	huma.Get(api, "/template/small", rendered(&p.Small))

	huma.Get(api, "/template/medium", rendered(&p.Medium))
}
