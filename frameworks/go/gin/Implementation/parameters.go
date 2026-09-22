package implementation

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type ParametersOne struct {
	One int `uri:"one" json:"one"`
}

type ParametersTwo struct {
	One int `uri:"one" json:"one"`
	Two int `uri:"two" json:"two"`
}

// parametersRoutes bind router captures with ShouldBindUri, which converts each to the integer
// its field declares. Gin's tree prefers the static segment of the static route.
func parametersRoutes(r *gin.Engine, p *Payloads) {
	r.GET("/parameters/static/segment/literal", func(c *gin.Context) { c.JSON(http.StatusOK, &p.Small) })

	r.GET("/parameters/:one/segment/literal", func(c *gin.Context) {
		var captured ParametersOne
		if err := c.ShouldBindUri(&captured); err != nil {
			refuse(c, err)
			return
		}
		c.JSON(http.StatusOK, Echoed[ParametersOne]{&p.Small, captured})
	})

	r.GET("/parameters/:one/with-second/:two", func(c *gin.Context) {
		var captured ParametersTwo
		if err := c.ShouldBindUri(&captured); err != nil {
			refuse(c, err)
			return
		}
		c.JSON(http.StatusOK, Echoed[ParametersTwo]{&p.Small, captured})
	})
}
