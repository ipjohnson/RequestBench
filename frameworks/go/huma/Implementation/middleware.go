package implementation

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
)

// middlewareRoutes put no-op layers in front of the handler, as Huma middleware on the operation
// itself, which runs after router middleware and before the handler.
func middlewareRoutes(api huma.API, p *Payloads) {
	small := func(ctx context.Context, _ *struct{}) (*PayloadOutput, error) {
		return &PayloadOutput{Body: &p.Small}, nil
	}

	huma.Get(api, "/middleware/none", small)

	huma.Get(api, "/middleware/four", small, func(o *huma.Operation) { o.Middlewares = layered(4) })

	huma.Get(api, "/middleware/sixteen", small, func(o *huma.Operation) { o.Middlewares = layered(16) })
}

// rb:wiring middleware.*
// noop is one layer: it calls the next and does nothing else.
func noop(ctx huma.Context, next func(huma.Context)) {
	next(ctx)
}

// layered is count no-op layers, for an operation's Middlewares.
func layered(count int) huma.Middlewares {
	layers := make(huma.Middlewares, count)
	for i := range layers {
		layers[i] = noop
	}
	return layers
}

// rb:end
