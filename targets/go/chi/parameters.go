// parameters: router captures with segment depth held constant.
package main

import "github.com/go-chi/chi/v5"

func registerParameters(r chi.Router) {
	r.Get("/parameters/static/segment/literal", payload("small"))

	r.Get("/parameters/{one}", payload("small"))

	r.Get("/parameters/{one}/with-second/{two}", payload("small"))
}
