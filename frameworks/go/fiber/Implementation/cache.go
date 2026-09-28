package implementation

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cache"
)

// cacheRoutes replay a stored answer and skip the handler, through Fiber's cache middleware. It
// keys an entry on the method, the path and the query, and partitions it on the request
// headers a stored answer's Vary names. The handler writes x-rb-serial, which the cache keeps
// because it stores the response's headers, so a replayed answer repeats the serial it was
// stored with.
func cacheRoutes(app *fiber.App, p *Payloads) {
	one := []string{"x-rb-tenant"}
	many := []string{"x-rb-channel", "x-rb-region", "x-rb-tenant"}
	// rb:wiring cache.*
	// One store for the process, keeping each answer 30 seconds. It is sized in bytes, and its
	// default of 1 MB holds the cache family's 52 answers.
	replayed := cache.New(cache.Config{
		Expiration:           30 * time.Second,
		StoreResponseHeaders: true,
	})

	app.Get("/cache/small/:key", replayed, fresh(&p.Small))

	app.Get("/cache/medium/:key", replayed, fresh(&p.Medium))

	app.Get("/cache/large/:key", replayed, fresh(&p.Large))

	app.Get("/cache/vary/one/:key", replayed, varied(one), fresh(&p.Small))

	app.Get("/cache/vary/many/:key", replayed, varied(many), fresh(&p.Small))
}

// rb:wiring cache.*
// varied writes the Vary header, which is what the cache partitions the route's entries on.
func varied(names []string) fiber.Handler {
	vary := strings.Join(names, ", ")
	return func(c fiber.Ctx) error {
		c.Set(fiber.HeaderVary, vary)
		return c.Next()
	}
}

// rb:end
