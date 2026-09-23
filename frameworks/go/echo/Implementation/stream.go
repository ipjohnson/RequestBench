package implementation

import (
	"encoding/json"
	"net/http"

	"github.com/labstack/echo/v5"
)

// streamRoutes write items.medium's rows one per line, as Echo's streaming cookbook streams
// records: an encoder on the response, and a flush through net/http's ResponseController after
// each. The length is never known, so the answer goes out chunked.
func streamRoutes(e *echo.Echo, p *Payloads) {
	e.GET("/stream/items", func(c *echo.Context) error {
		c.Response().Header().Set(echo.HeaderContentType, "application/x-ndjson")
		c.Response().WriteHeader(http.StatusOK)

		// The encoder ends each row with a newline.
		encoder := json.NewEncoder(c.Response())
		flusher := http.NewResponseController(c.Response())
		for i := range p.Medium.Items {
			if err := encoder.Encode(&p.Medium.Items[i]); err != nil {
				return err
			}
			if err := flusher.Flush(); err != nil {
				return err
			}
		}
		return nil
	})
}
