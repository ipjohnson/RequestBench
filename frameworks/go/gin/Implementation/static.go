package implementation

import (
	"github.com/gin-gonic/gin"
)

// staticRoutes serve the payload directory with gin's Static, which registers GET and HEAD on
// /static/*filepath and hands the file to net/http's FileServer.
func staticRoutes(r *gin.Engine, p *Payloads) {
	// rb:handler static.file
	r.Static("/static", p.Directory)
}
