package implementation

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// HeadersBound is the three headers /headers/bind binds. The tags are in the canonical form
// net/http keys a header by, which gin would otherwise work out on every bind.
type HeadersBound struct {
	Tenant    string `header:"X-Rb-Tenant" json:"tenant"`
	RequestID string `header:"X-Rb-Request-Id" json:"requestId"`
	Account   int    `header:"X-Rb-Account" json:"account"`
}

// headersRoutes: /headers reads no header, and /headers/bind binds three with ShouldBindHeader,
// the account as an integer.
func headersRoutes(r *gin.Engine, p *Payloads) {
	r.GET("/headers", func(c *gin.Context) { c.JSON(http.StatusOK, &p.Small) })

	r.GET("/headers/bind", func(c *gin.Context) {
		var bound HeadersBound
		if err := c.ShouldBindHeader(&bound); err != nil {
			refuse(c, err)
			return
		}
		c.JSON(http.StatusOK, Echoed[HeadersBound]{&p.Small, bound})
	})
}
