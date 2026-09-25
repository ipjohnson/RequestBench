package implementation

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
)

// baselineRoutes is the dispatch floor, with nothing serialised: a []byte body, which Huma writes
// as it is.
func baselineRoutes(api huma.API) {
	huma.Get(api, "/plaintext", func(ctx context.Context, _ *struct{}) (*TextOutput, error) {
		return &TextOutput{ContentType: "text/plain; charset=utf-8", Body: []byte("Hello, World!")}, nil
	})
}
