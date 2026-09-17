// etag and cache: the framework's own scoping around the middleware in _shared.
//
// chi routes plain http.Handlers, so neither middleware has anything chi-shaped in it and
// both live beside the domain: net/http computes no validator for a dynamic response and
// stores no response either, so two targets holding two copies would drift on an algorithm
// and the drift would read as a framework result. What is chi's own is where they attach,
// which is the part that is actually the framework's.
package main

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// served is payload() plus the freshness counter both families carry.
func served(size string, extra map[string]string) http.HandlerFunc {
	body := d.Payload(size)
	return func(w http.ResponseWriter, _ *http.Request) {
		for name, value := range extra {
			w.Header().Set(name, value)
		}
		w.Header().Set("x-rb-serial", d.NextSerial())
		writeJSON(w, 200, body)
	}
}

func registerEtag(r chi.Router) {
	// rb:snippet etag.small etag.large etag.match_large etag.stale_large
	for _, size := range []string{"small", "large"} {
		r.With(d.ConditionalGet).Get("/etag/"+size, served(size, nil))
	}
}

func registerCache(r chi.Router) {
	// One store for the target rather than one per route, so the capacity the fixture
	// derives from the key count means what it says.
	store := d.NewStore()
	// rb:snippet cache.small cache.medium cache.large
	for _, size := range []string{"small", "medium", "large"} {
		r.With(d.Replay(store, nil)).Get("/cache/"+size, served(size, nil))
	}
	// rb:snippet cache.vary_one cache.vary_many
	for _, which := range []string{"one", "many"} {
		on := d.VaryOn(which)
		r.With(d.Replay(store, on)).Get("/cache/vary/"+which,
			served("small", map[string]string{"vary": strings.Join(on, ", ")}))
	}
}
