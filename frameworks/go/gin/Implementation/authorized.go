package implementation

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// authorizedRoutes put a middleware in front of the handler that refuses any bearer token but
// settings.json's. Gin ships basic authentication and nothing for a bearer token, so the
// middleware is the application's, and gin's abort is what stops the chain.
func authorizedRoutes(r *gin.Engine, p *Payloads) {
	r.GET("/authorized/small", requireToken(p.Settings.Token), func(c *gin.Context) { c.JSON(http.StatusOK, &p.Small) })
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
