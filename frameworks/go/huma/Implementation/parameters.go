package implementation

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
)

type ParametersOne struct {
	One int `json:"one"`
}

type ParametersTwo struct {
	One int `json:"one"`
	Two int `json:"two"`
}

// parametersRoutes bind path parameters into typed input fields. humago registers each operation
// as a ServeMux pattern, and the ServeMux answers the static segment with its own route, because
// it is more specific than the {one} wildcard.
func parametersRoutes(api huma.API, p *Payloads) {
	huma.Get(api, "/parameters/static/segment/literal", func(ctx context.Context, _ *struct{}) (*PayloadOutput, error) {
		return &PayloadOutput{Body: &p.Small}, nil
	})

	huma.Get(api, "/parameters/{one}/segment/literal", func(ctx context.Context, in *struct {
		One int `path:"one"`
	}) (*EchoedOutput[ParametersOne], error) {
		return &EchoedOutput[ParametersOne]{Body: Echoed[ParametersOne]{&p.Small, ParametersOne{One: in.One}}}, nil
	})

	huma.Get(api, "/parameters/{one}/with-second/{two}", func(ctx context.Context, in *struct {
		One int `path:"one"`
		Two int `path:"two"`
	}) (*EchoedOutput[ParametersTwo], error) {
		return &EchoedOutput[ParametersTwo]{Body: Echoed[ParametersTwo]{&p.Small, ParametersTwo{One: in.One, Two: in.Two}}}, nil
	})
}
