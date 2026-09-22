package implementation

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type QueryOne struct {
	Page int `form:"page" json:"page"`
}

// Search is query.many's eight values, which forms.urlencoded posts as a form.
type Search struct {
	Page     int    `form:"page" json:"page"`
	Size     int    `form:"size" json:"size"`
	Status   string `form:"status" json:"status"`
	Category string `form:"category" json:"category"`
	Sort     string `form:"sort" json:"sort"`
	Q        string `form:"q" json:"q"`
	MinPrice int    `form:"minPrice" json:"minPrice"`
	MaxPrice int    `form:"maxPrice" json:"maxPrice"`
}

// queryRoutes bind the query string with ShouldBindQuery, where a field's form tag names the
// parameter and its type is the conversion.
func queryRoutes(r *gin.Engine, p *Payloads) {
	r.GET("/query/one", func(c *gin.Context) {
		var query QueryOne
		if err := c.ShouldBindQuery(&query); err != nil {
			refuse(c, err)
			return
		}
		c.JSON(http.StatusOK, Echoed[QueryOne]{&p.Small, query})
	})

	r.GET("/query/many", func(c *gin.Context) {
		var query Search
		if err := c.ShouldBindQuery(&query); err != nil {
			refuse(c, err)
			return
		}
		c.JSON(http.StatusOK, Echoed[Search]{&p.Small, query})
	})
}
