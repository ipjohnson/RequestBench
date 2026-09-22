package implementation

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// baselineRoutes is the dispatch floor, with nothing serialised.
func baselineRoutes(r *gin.Engine) {
	r.GET("/plaintext", func(c *gin.Context) { c.String(http.StatusOK, "Hello, World!") })
}
