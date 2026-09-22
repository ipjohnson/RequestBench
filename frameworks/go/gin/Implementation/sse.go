package implementation

import (
	"io"

	"github.com/gin-gonic/gin"
)

// sseRoutes send items.medium's rows as server-sent events. c.SSEvent renders one event with
// gin's sse package, which writes the row as the event's JSON data, and c.Stream flushes it.
func sseRoutes(r *gin.Engine, p *Payloads) {
	r.GET("/sse/medium", func(c *gin.Context) {
		rows := p.Medium.Items
		next := 0
		c.Stream(func(w io.Writer) bool {
			c.SSEvent("message", &rows[next])
			next++
			return next < len(rows)
		})
	})
}
