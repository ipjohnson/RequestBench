// headers: the request header map at five and at thirty headers, left unread and with three of
// them bound and echoed.
//
// /headers reads no header at all, so headers.many minus headers.few is the cost of
// materialising 25 nobody asked for.
//
// gorilla/mux has no binder to plug into: it routes net/http handlers, so req.Header.Get is as
// far as the framework goes and the conversion is the handler's own work. An account that is
// not a number converts to zero, as a query parameter does here. Each name is the canonical
// form net/http keys a header by, so Get finds it without rewriting it first.
package main

import (
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// rb:wiring headers.*
type boundHeaders struct {
	Tenant    string `json:"tenant"`
	RequestID string `json:"request_id"`
	Account   int    `json:"account"`
}

func registerHeaders(r *mux.Router) {
	r.Handle("/headers", payload("small")).Methods("GET")

	r.HandleFunc("/headers/bind", func(w http.ResponseWriter, req *http.Request) {
		account, _ := strconv.Atoi(req.Header.Get("X-Rb-Account"))
		writeJSON(w, 200, d.WithEcho("small", boundHeaders{
			Tenant:    req.Header.Get("X-Rb-Tenant"),
			RequestID: req.Header.Get("X-Rb-Request-Id"),
			Account:   account,
		}))
	}).Methods("GET")
}
