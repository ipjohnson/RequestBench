// The one template engine every Go target renders with, and the one template.
//
// Pinned the way the gzip level is. An engine is a large constant factor, so five targets
// on five engines would make template.small a comparison of engines with the framework
// underneath it invisible. Gin reaches this template through SetHTMLTemplate, which is its
// own facility; the four frameworks with no view layer call RenderItems directly.
//
// Embedded rather than read from disk: a container image is the built binary on a bare
// alpine, so a template file beside the source would not be there to load.
package hosts

import (
	_ "embed"
	"html/template"
	"strings"

	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

//go:embed views/items.tmpl
var ItemsTemplate string

// Parsed once, rendered per request, which is what every other language does. A
// precomputed string would measure nothing.
var items = template.Must(template.New("items.tmpl").Parse(ItemsTemplate))

func RenderItems(body d.PayloadBody) string {
	var out strings.Builder
	_ = items.Execute(&out, body)
	return out.String()
}
