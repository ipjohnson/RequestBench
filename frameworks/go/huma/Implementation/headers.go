package implementation

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
)

// HeadersBound is the three headers /headers/bind reads.
type HeadersBound struct {
	Tenant    string `header:"X-Rb-Tenant" json:"tenant"`
	RequestID string `header:"X-Rb-Request-Id" json:"requestId"`
	Account   int    `header:"X-Rb-Account" json:"account"`
}

// headersRoutes: /headers reads no header, and /headers/bind binds three into typed input fields,
// which Huma converts.
func headersRoutes(api huma.API, p *Payloads) {
	huma.Get(api, "/headers", func(ctx context.Context, _ *struct{}) (*PayloadOutput, error) {
		return &PayloadOutput{Body: &p.Small}, nil
	})

	huma.Get(api, "/headers/bind", func(ctx context.Context, in *HeadersBound) (*EchoedOutput[HeadersBound], error) {
		return &EchoedOutput[HeadersBound]{Body: Echoed[HeadersBound]{&p.Small, *in}}, nil
	})
}
