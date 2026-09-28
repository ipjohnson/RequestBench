package implementation

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// authorizedRoutes put a middleware in front of the handler that refuses any bearer token but
// the one it is given. Gin ships basic authentication and nothing for a bearer token, so the
// middleware is the application's, and gin's abort is what stops the chain.
func authorizedRoutes(r *gin.Engine, p *Payloads) {
	r.GET("/authorized/small", requireToken("5a7cc77ed0dcb825806b6f872026c317"), func(c *gin.Context) { c.JSON(http.StatusOK, &p.Small) })
}

// rb:wiring authorized.*
func requireToken(token string) gin.HandlerFunc {
	expected := "Bearer " + token
	return func(c *gin.Context) {
		if c.GetHeader("Authorization") != expected {
			c.AbortWithStatus(http.StatusForbidden)
			return
		}
		c.Next()
	}
}
