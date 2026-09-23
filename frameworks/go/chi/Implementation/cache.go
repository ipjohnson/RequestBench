package implementation

import (
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/stampede"
	memcache "github.com/goware/cachestore-mem"
)

// cacheRoutes replay a stored answer and skip the handler. chi ships no response cache, and its
// README lists go-chi/stampede for this. stampede runs the handler once for a key, however many
// requests for it arrive together, and keeps the answer, headers included, for the TTL. The
// handler writes x-rb-serial, so a replayed answer repeats the serial it was stored with.
func cacheRoutes(r chi.Router, p *Payloads) error {
	settings := p.Settings.Cache
	one := headerNames(settings.Vary.One)
	many := headerNames(settings.Vary.Many)
	// rb:wiring cache.*
	// One in-memory store for the process, sized in entries, as stampede's README builds one.
	store, err := memcache.NewBackend(uint32(settings.Capacity))
	if err != nil {
		return err
	}
	ttl := time.Duration(settings.TTLSeconds) * time.Second
	byPath := stampede.Handler(slog.Default(), store, ttl)
	byTenant := stampede.Handler(slog.Default(), store, ttl, stampede.WithHTTPCacheKeyRequestHeaders(one))
	byAll := stampede.Handler(slog.Default(), store, ttl, stampede.WithHTTPCacheKeyRequestHeaders(many))
	// rb:end

	r.With(byPath).Get("/cache/small", fresh(&p.Small))

	r.With(byPath).Get("/cache/medium", fresh(&p.Medium))

	r.With(byPath).Get("/cache/large", fresh(&p.Large))

	r.With(byTenant, varied(one)).Get("/cache/vary/one", fresh(&p.Small))

	r.With(byAll, varied(many)).Get("/cache/vary/many", fresh(&p.Small))
	return nil
}

// varied writes the Vary header, which tells a cache in front of the framework what the answer
// depends on. stampede keys on the headers it is given, not on this one.
func varied(names []string) func(http.Handler) http.Handler {
	vary := strings.Join(names, ", ")
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Vary", vary)
			next.ServeHTTP(w, r)
		})
	}
}
