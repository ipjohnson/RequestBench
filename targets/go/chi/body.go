// body: the parser and the validator, with size crossed against validation.
//
// bind parses and binds without validating, so validate minus bind is the validator alone
// rather than the validator plus the parse.
package main

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// The request body as a value, or the 422 every target answers when it is not JSON.
func body(req *http.Request) (map[string]any, error) {
	var m map[string]any
	if err := json.NewDecoder(req.Body).Decode(&m); err != nil {
		return nil, d.MalformedBody()
	}
	return m, nil
}

func bind(w http.ResponseWriter, req *http.Request) {
	m, err := body(req)
	send(w, d.BindEcho(m), err, 200)
}

func validateAll(w http.ResponseWriter, req *http.Request) {
	m, err := body(req)
	if err != nil {
		fail(w, err)
		return
	}
	v, err := d.ValidateOrder(m)
	send(w, v, err, 200)
}

func validateFirst(w http.ResponseWriter, req *http.Request) {
	m, err := body(req)
	if err != nil {
		fail(w, err)
		return
	}
	v, err := d.ValidateOrderFirst(m)
	send(w, v, err, 200)
}

func registerBody(r chi.Router) {
	r.Post("/body/bind/small", bind)

	r.Post("/body/bind/medium", bind)

	r.Post("/body/validate/small", validateAll)

	r.Post("/body/validate/medium", validateAll)

	r.Post("/body/validate/first-error", validateFirst)
}
