// etag and cache: the framework's own scoping around the middleware in _shared.
//
// gorilla/mux routes plain http.Handlers, so neither middleware has anything mux-shaped in
// it and both live beside the domain: net/http computes no validator for a dynamic response
// and stores no response either, so two targets holding two copies would drift on an
// algorithm and the drift would read as a framework result. What is mux's own is where they
// attach, which is the part that is actually the framework's.
package main

import (
	"net/http"
	"strings"

	"github.com/gorilla/mux"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// rb:wiring cache.*,etag.*
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

func registerEtag(r *mux.Router) {
	// rb:handler etag.*
	for _, size := range []string{"small", "large"} {
		r.Handle("/etag/"+size, chain(served(size, nil), d.ConditionalGet)).Methods("GET")
	}
}

func registerCache(r *mux.Router) {
	// One store for the target rather than one per route, so the capacity the fixture
	// derives from the key count means what it says.
	// rb:wiring cache.*
	store := d.NewStore()
	// rb:handler cache.small,cache.medium,cache.large
	for _, size := range []string{"small", "medium", "large"} {
		r.Handle("/cache/"+size, chain(served(size, nil), d.Replay(store, nil))).Methods("GET")
	}
	// rb:handler cache.vary_one,cache.vary_many
	for _, which := range []string{"one", "many"} {
		on := d.VaryOn(which)
		handler := served("small", map[string]string{"vary": strings.Join(on, ", ")})
		r.Handle("/cache/vary/"+which, chain(handler, d.Replay(store, on))).Methods("GET")
	}
}
