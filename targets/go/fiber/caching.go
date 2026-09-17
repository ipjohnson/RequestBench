// etag and cache: both of Fiber's own middlewares, which is what makes this target the
// exception among the five Go ones.
//
// Fiber ships an etag middleware that hashes the body the handler wrote and answers
// If-None-Match itself, and a cache middleware that stores the whole response and replays
// it before the handler is reached. The other four Go targets have neither in the framework
// or in net/http and hold the digest and the store beside the domain instead.
package main

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cache"
	"github.com/gofiber/fiber/v3/middleware/etag"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// served is payload() plus the freshness counter both families carry.
func served(size string, extra map[string]string) fiber.Handler {
	body := d.Payload(size)
	return func(c fiber.Ctx) error {
		for name, value := range extra {
			c.Set(name, value)
		}
		c.Set("x-rb-serial", d.NextSerial())
		return c.JSON(body)
	}
}

func registerEtag(app *fiber.App) {
	// Strong, over the exact response bytes, which is the middleware's own default.
	conditional := etag.New()
	// rb:snippet etag.small etag.large etag.match_large etag.stale_large
	for _, size := range []string{"small", "large"} {
		route(app, fiber.MethodGet, "/etag/"+size, conditional,
			served(size, map[string]string{"cache-control": d.Cacheable}))
	}
}

func registerCache(app *fiber.App) {
	spec := d.CacheSpec()
	ttl := time.Duration(spec.TTLSec) * time.Second
	// StoreResponseHeaders because the freshness counter has to come back with the stored
	// response: without it a replay answers the right bytes and says nothing about which
	// run of the handler produced them. KeyHeaders is the vary: empty on the rows keyed by
	// path alone, since the middleware's default partitions on three Accept headers the
	// plan never sends and those would key on the empty string forever.
	byPath := cache.New(cache.Config{
		Expiration: ttl, StoreResponseHeaders: true, KeyHeaders: []string{},
	})
	// rb:snippet cache.small cache.medium cache.large
	for _, size := range []string{"small", "medium", "large"} {
		route(app, fiber.MethodGet, "/cache/"+size, byPath, served(size, nil))
	}
	// rb:snippet cache.vary_one cache.vary_many
	for _, which := range []string{"one", "many"} {
		on := d.VaryOn(which)
		keyed := cache.New(cache.Config{
			Expiration: ttl, StoreResponseHeaders: true, KeyHeaders: on,
		})
		route(app, fiber.MethodGet, "/cache/vary/"+which, keyed,
			served("small", map[string]string{"vary": strings.Join(on, ", ")}))
	}
}
