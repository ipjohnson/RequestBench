// Gin's own header binding, rather than a read of the raw header map in the handler.
//
// `header:` is Gin's tag for a request header, and ShouldBindHeader is what reads it. The
// struct is both what Gin fills and what the handler echoes, so nothing copies one shape into
// another. Each tag is the canonical form net/http keys a header by, which Gin would
// otherwise rewrite on every bind before it looks the header up.
//
// Gin decides what a header it cannot bind is: a missing one leaves the field at its zero
// value, and an account that will not parse is an error carrying the strconv message. The
// endpoint set never sends one, but it is the framework's line and not this file's.
package main

import (
	"github.com/gin-gonic/gin"
)

// rb:wiring headers.*
type boundHeaders struct {
	Tenant    string `header:"X-Rb-Tenant"     json:"tenant"`
	RequestID string `header:"X-Rb-Request-Id" json:"request_id"`
	Account   int    `header:"X-Rb-Account"    json:"account"`
}

// rb:wiring headers.*
// bindHeaders fills out from the request headers, answering the failure itself if there is
// one, in the shape bindQuery answers a query Gin could not bind.
func bindHeaders(c *gin.Context, out any) bool {
	if err := c.ShouldBindHeader(out); err != nil {
		c.JSON(400, gin.H{"error": "invalid_header", "detail": err.Error()})
		return false
	}
	return true
}
