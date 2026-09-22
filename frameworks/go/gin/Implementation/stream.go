package implementation

import (
	"io"

	"github.com/gin-gonic/gin"
	ginjson "github.com/gin-gonic/gin/codec/json"
)

// streamRoutes write items.medium's rows one per line through c.Stream, which flushes after each
// step. The length is never known, so the answer goes out chunked.
func streamRoutes(r *gin.Engine, p *Payloads) {
	r.GET("/stream/items", func(c *gin.Context) {
		rows := p.Medium.Items
		c.Header("Content-Type", "application/x-ndjson")
		next := 0
		c.Stream(func(w io.Writer) bool {
			// The encoder ends each row with a newline.
			if err := ginjson.API.NewEncoder(w).Encode(&rows[next]); err != nil {
				return false
			}
			next++
			return next < len(rows)
		})
	})
}
