// json: the serializer and response buffering across three size regimes.
//
// Three static routes, not /json/{size}. The size set is fixed, so a capture would make the
// router pay parameter cost on the family every other target serves from a static route,
// and it would answer 200 with an empty body for a size that does not exist.
package main

import (
	"net/http"

	"github.com/gorilla/mux"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// The response is read once and served from the closure rather than looked up per request:
// the map lookup is not what any of these endpoints is measuring.
// rb:wiring json.*,parameters.*,headers.*,middleware.*,authorized.*
func payload(size string) http.HandlerFunc {
	body := d.Payload(size)
	return func(w http.ResponseWriter, _ *http.Request) { writeJSON(w, 200, body) }
}

func registerJSON(r *mux.Router) {
	r.Handle("/json/small", payload("small")).Methods("GET")

	r.Handle("/json/medium", payload("medium")).Methods("GET")

	r.Handle("/json/large", payload("large")).Methods("GET")
}
