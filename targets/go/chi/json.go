// json: the serializer and response buffering across three size regimes.
//
// Three static routes, not /json/{size}. The size set is fixed, so a capture would make the
// router pay parameter cost on the family every other target serves from a static route,
// and it would answer 200 with an empty body for a size that does not exist.
package main

import (
	"net/http"
	"runtime/debug"

	"github.com/go-chi/chi/v5"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// chi publishes no version constant, so it is read from the build info the linker embeds,
// which is where the Go targets get every other resolved version.
var chiVersion = func() string {
	info, ok := debug.ReadBuildInfo()
	if !ok {
		return ""
	}
	for _, m := range info.Deps {
		if m.Path == "github.com/go-chi/chi/v5" {
			return m.Version
		}
	}
	return ""
}()

// The response is read once and served from the closure rather than looked up per request:
// the map lookup is not what any of these endpoints is measuring.
func payload(size string) http.HandlerFunc {
	body := d.Payload(size)
	return func(w http.ResponseWriter, _ *http.Request) { writeJSON(w, 200, body) }
}

func registerJSON(r chi.Router) {
	r.Get("/json/small", payload("small"))

	r.Get("/json/medium", payload("medium"))

	r.Get("/json/large", payload("large"))
}
