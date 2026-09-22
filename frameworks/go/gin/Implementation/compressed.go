package implementation

import (
	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
)

// compressedRoutes answer like any other. gin-contrib/gzip, on the /compressed group alone,
// gzips the answer when the request asks for it.
func compressedRoutes(r *gin.Engine, p *Payloads) {
	// rb:wiring compressed.*
	compressed := r.Group("/compressed", gzip.Gzip(gzip.DefaultCompression))

	// rb:handler compressed.gzip_small,compressed.identity_small
	compressed.GET("/small", fresh(&p.Small))

	// rb:handler compressed.gzip_large,compressed.identity_large
	compressed.GET("/large", fresh(&p.Large))
}
