package implementation

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
)

// jsonRoutes serialise a payload the framework already holds, at three sizes, with Huma's JSON
// format.
func jsonRoutes(api huma.API, p *Payloads) {
	huma.Get(api, "/json/small", func(ctx context.Context, _ *struct{}) (*PayloadOutput, error) {
		return &PayloadOutput{Body: &p.Small}, nil
	})

	huma.Get(api, "/json/medium", func(ctx context.Context, _ *struct{}) (*PayloadOutput, error) {
		return &PayloadOutput{Body: &p.Medium}, nil
	})

	huma.Get(api, "/json/large", func(ctx context.Context, _ *struct{}) (*PayloadOutput, error) {
		return &PayloadOutput{Body: &p.Large}, nil
	})
}
