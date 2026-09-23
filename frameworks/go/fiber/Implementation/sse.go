package implementation

import (
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/sse"
)

// sseRoutes send items.medium's rows as server-sent events through Fiber's sse handler, which
// sets the headers, streams the body and flushes each event. An event with no name is
// dispatched as a message, and its data is the row encoded with the app's JSONEncoder.
func sseRoutes(app *fiber.App, p *Payloads) {
	app.Get("/sse/medium", sse.New(sse.Config{
		Handler: func(_ fiber.Ctx, stream *sse.Stream) error {
			rows := p.Medium.Items
			for i := range rows {
				if err := stream.Event(sse.Event{Data: &rows[i]}); err != nil {
					return err
				}
			}
			return nil
		},
	}))
}
