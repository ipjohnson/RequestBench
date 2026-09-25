// Package implementation is the RequestBench corpus answered by Huma over Go's ServeMux, through
// Huma's humago adapter. Each corpus family's operations are registered by a function of its own,
// in a file named for the family.
package implementation

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humago"
)

// New registers every operation over the payloads on a Huma API over a new ServeMux. A host serves
// the ServeMux, and the API writes the OpenAPI document.
func New(p *Payloads) (*http.ServeMux, huma.API) {
	mux := http.NewServeMux()
	config := huma.DefaultConfig("RequestBench", "1.0.0")
	// The default create hook adds a $schema property to every JSON answer, and a Link header that
	// names the schema. The corpus compares each answer's body whole, so the hook is dropped, as
	// Huma's JSON Schema registry page shows.
	config.CreateHooks = nil
	api := humago.New(mux, config)

	contractRoutes(api)
	baselineRoutes(api)
	jsonRoutes(api, p)
	middlewareRoutes(api, p)
	parametersRoutes(api, p)
	queryRoutes(api, p)
	headersRoutes(api, p)
	bodyRoutes(api)
	authorizedRoutes(api, p)
	cacheRoutes(api, p)
	compressedRoutes(api, p)
	etagRoutes(api, p)
	templateRoutes(api, p)
	itemsRoutes(api, p)
	corsRoutes(api, p)
	formsRoutes(api, p)
	streamRoutes(api, p)
	sseRoutes(api, p)
	staticRoutes(mux, p)

	return mux, api
}
