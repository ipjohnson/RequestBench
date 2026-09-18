// Gin's own path binding, rather than c.Param and a conversion in the handler.
//
// `uri:` is Gin's tag for a route capture, and ShouldBindUri is what reads it. The struct is
// both what Gin fills and what the handler echoes, so nothing copies one shape into another.
//
// A capture that will not parse as an integer is an error carrying the strconv message. The
// endpoint set never sends one, but it is the framework's line and not this file's.
package main

import (
	"github.com/gin-gonic/gin"
)

// rb:wiring parameters.*
type oneCapture struct {
	One int `uri:"one" json:"one"`
}

// rb:wiring parameters.*
type twoCaptures struct {
	One int `uri:"one" json:"one"`
	Two int `uri:"two" json:"two"`
}

// rb:wiring parameters.*
// bindCaptures fills out from the route's captures, answering the failure itself if there is
// one, in the shape bindQuery answers a query Gin could not bind.
func bindCaptures(c *gin.Context, out any) bool {
	if err := c.ShouldBindUri(out); err != nil {
		c.JSON(400, gin.H{"error": "invalid_path", "detail": err.Error()})
		return false
	}
	return true
}
