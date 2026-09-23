package implementation

import (
	"bufio"
	"encoding/json"

	"github.com/gofiber/fiber/v3"
)

// streamRoutes write items.medium's rows one per line through c.SendStreamWriter, which hands
// fasthttp a function that writes the body after the handler returns. Each row is flushed as it
// is written. The length is never known, so the answer goes out chunked.
func streamRoutes(app *fiber.App, p *Payloads) {
	app.Get("/stream/items", func(c fiber.Ctx) error {
		rows := p.Medium.Items
		c.Set(fiber.HeaderContentType, "application/x-ndjson")
		return c.SendStreamWriter(func(w *bufio.Writer) {
			// The encoder ends each row with a newline.
			encoder := json.NewEncoder(w)
			for i := range rows {
				if err := encoder.Encode(&rows[i]); err != nil {
					return
				}
				if err := w.Flush(); err != nil {
					return
				}
			}
		})
	})
}
