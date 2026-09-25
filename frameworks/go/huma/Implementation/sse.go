package implementation

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/sse"
)

// sseRoutes send items.medium's rows through Huma's sse package, each row the data of one event of
// the default type, message, which sse writes with no event field. sse flushes after each event.
func sseRoutes(api huma.API, p *Payloads) {
	// rb:handler sse.medium
	sse.Register(api, huma.Operation{
		OperationID: "get-sse-medium",
		Method:      http.MethodGet,
		Path:        "/sse/medium",
	}, map[string]any{"message": Item{}}, func(ctx context.Context, _ *struct{}, send sse.Sender) {
		for i := range p.Medium.Items {
			if send.Data(p.Medium.Items[i]) != nil {
				return
			}
		}
	})
}
