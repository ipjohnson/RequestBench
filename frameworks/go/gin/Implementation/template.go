package implementation

import (
	"embed"
	"net/http"

	"github.com/gin-gonic/gin"
)

// rb:wiring template.*

//go:embed views/items.tmpl
var views embed.FS

// templateRoutes render the payload through gin's HTML render, which runs html/template. The
// template is compiled into the binary, so the image needs no file beside it.
func templateRoutes(r *gin.Engine, p *Payloads) {
	// rb:wiring template.*
	// Outside debug mode gin parses the template once, here.
	r.LoadHTMLFS(http.FS(views), "views/items.tmpl")

	r.GET("/template/small", func(c *gin.Context) { c.HTML(http.StatusOK, "items.tmpl", &p.Small) })

	r.GET("/template/medium", func(c *gin.Context) { c.HTML(http.StatusOK, "items.tmpl", &p.Medium) })
}
