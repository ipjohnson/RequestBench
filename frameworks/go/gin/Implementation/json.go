package implementation

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// jsonRoutes serialise a payload the framework already holds, at three sizes. c.JSON writes it
// through gin's JSON codec, which is encoding/json unless a build tag picks another.
func jsonRoutes(r *gin.Engine, p *Payloads) {
	r.GET("/json/small", func(c *gin.Context) { c.JSON(http.StatusOK, &p.Small) })

	r.GET("/json/medium", func(c *gin.Context) { c.JSON(http.StatusOK, &p.Medium) })

	r.GET("/json/large", func(c *gin.Context) { c.JSON(http.StatusOK, &p.Large) })
}
