package implementation

import (
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/compress"
)

// compressedRoutes answer like any other. Fiber's compress middleware, on these two routes
// alone, hands the answer to fasthttp's compression when the request accepts it, at the fastest
// level every framework here compresses at.
func compressedRoutes(app *fiber.App, p *Payloads) {
	// rb:wiring compressed.*
	compressed := compress.New(compress.Config{Level: compress.LevelBestSpeed})

	app.Get("/compressed/small", compressed, fresh(&p.Small))

	app.Get("/compressed/large", compressed, fresh(&p.Large))
}
