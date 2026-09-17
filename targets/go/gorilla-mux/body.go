// body: the parser and the validator, with size crossed against validation.
//
// bind parses and binds without validating, so validate minus bind is the validator alone
// rather than the validator plus the parse.
package main

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// The request body as a value, or this target's own answer when it is not JSON. A body the
// decoder could not read never reaches the validator, so it names no field.
func body(w http.ResponseWriter, req *http.Request) (map[string]any, bool) {
	var m map[string]any
	if err := json.NewDecoder(req.Body).Decode(&m); err != nil {
		writeJSON(w, 400, map[string]any{"error": "invalid_body", "detail": err.Error()})
		return nil, false
	}
	return m, true
}

func bind(w http.ResponseWriter, req *http.Request) {
	m, ok := body(w, req)
	if !ok {
		return
	}
	writeJSON(w, 200, d.BindEcho(m))
}

func validateAll(w http.ResponseWriter, req *http.Request) { validate(w, req, false) }

func validateFirst(w http.ResponseWriter, req *http.Request) { validate(w, req, true) }

func validate(w http.ResponseWriter, req *http.Request, firstError bool) {
	m, ok := body(w, req)
	if !ok {
		return
	}
	v, errs := validateOrder(m, firstError)
	if errs != nil {
		writeJSON(w, 422, invalidBody(errs))
		return
	}
	writeJSON(w, 200, v)
}

func registerBody(r *mux.Router) {
	r.HandleFunc("/body/bind/small", bind).Methods("POST")

	r.HandleFunc("/body/bind/medium", bind).Methods("POST")

	r.HandleFunc("/body/validate/small", validateAll).Methods("POST")

	r.HandleFunc("/body/validate/medium", validateAll).Methods("POST")

	r.HandleFunc("/body/validate/first-error", validateFirst).Methods("POST")
}
