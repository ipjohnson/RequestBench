package implementation

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// streamRoutes answer a StreamResponse, Huma's streaming output, which writes items.medium's rows
// one per line and flushes after each. The length is never known, so the answer goes out chunked.
func streamRoutes(api huma.API, p *Payloads) {
	huma.Get(api, "/stream/items", func(ctx context.Context, _ *struct{}) (*huma.StreamResponse, error) {
		return &huma.StreamResponse{Body: func(ctx huma.Context) {
			ctx.SetHeader("Content-Type", "application/x-ndjson")
			writer := ctx.BodyWriter()
			flusher, _ := writer.(http.Flusher)
			// The encoder ends each row with a newline.
			encoder := json.NewEncoder(writer)
			for i := range p.Medium.Items {
				if err := encoder.Encode(&p.Medium.Items[i]); err != nil {
					return
				}
				if flusher != nil {
					flusher.Flush()
				}
			}
		}}, nil
	})
}
