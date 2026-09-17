// Gin's own query binding, rather than a hand-written read of the raw map.
//
// `form:` is Gin's tag for a query parameter, and ShouldBindQuery is what reads it. The
// struct is both what Gin fills and what the handler answers, so the response is the bound
// values and nothing copies one shape into another.
//
// Gin decides what a value it cannot bind is: a missing parameter leaves the field at its
// zero value, and one that will not parse is an error carrying the strconv message. That
// error never fires on the endpoint set, whose query strings are always complete and
// well-formed, but it is the framework's line and not this file's.
package main

import (
	"github.com/gin-gonic/gin"
)

type queryOne struct {
	Page int `form:"page" json:"page"`
}

type queryMany struct {
	Page     int    `form:"page"      json:"page"`
	Size     int    `form:"size"      json:"size"`
	Status   string `form:"status"    json:"status"`
	Category string `form:"category"  json:"category"`
	Sort     string `form:"sort"      json:"sort"`
	Q        string `form:"q"         json:"q"`
	MinPrice int    `form:"min_price" json:"min_price"`
	MaxPrice int    `form:"max_price" json:"max_price"`
}

// What domain.filter pages by. Not a response shape, so it carries no json tags.
type orderFilter struct {
	Page   int    `form:"page"`
	Size   int    `form:"size"`
	Status string `form:"status"`
}

// bindQuery fills out from the query string, answering the failure itself if there is one.
// The same 400 shape as a body Gin could not bind, because it is the same binder refusing.
func bindQuery(c *gin.Context, out any) bool {
	if err := c.ShouldBindQuery(out); err != nil {
		c.JSON(400, gin.H{"error": "invalid_query", "detail": err.Error()})
		return false
	}
	return true
}
