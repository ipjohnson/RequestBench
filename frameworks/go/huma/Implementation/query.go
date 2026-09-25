package implementation

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
)

type QueryOne struct {
	Page int `query:"page" json:"page"`
}

// Search is query.many's eight values, which forms.urlencoded posts as a form.
type Search struct {
	Page     int    `query:"page" json:"page"`
	Size     int    `query:"size" json:"size"`
	Status   string `query:"status" json:"status"`
	Category string `query:"category" json:"category"`
	Sort     string `query:"sort" json:"sort"`
	Q        string `query:"q" json:"q"`
	MinPrice int    `query:"minPrice" json:"minPrice"`
	MaxPrice int    `query:"maxPrice" json:"maxPrice"`
}

// queryRoutes bind the query string into typed input fields, which Huma converts.
func queryRoutes(api huma.API, p *Payloads) {
	huma.Get(api, "/query/one", func(ctx context.Context, in *QueryOne) (*EchoedOutput[QueryOne], error) {
		return &EchoedOutput[QueryOne]{Body: Echoed[QueryOne]{&p.Small, *in}}, nil
	})

	huma.Get(api, "/query/many", func(ctx context.Context, in *Search) (*EchoedOutput[Search], error) {
		return &EchoedOutput[Search]{Body: Echoed[Search]{&p.Small, *in}}, nil
	})
}
