// domain: application-shaped handler work and the write methods.
package main

import (
	"net/http"

	"github.com/gorilla/mux"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

func registerDomain(r *mux.Router) {
 // rb:snippet domain.filter
	r.HandleFunc("/domain/orders", func(w http.ResponseWriter, req *http.Request) {
		writeJSON(w, 200, d.DomainFilter(req.URL.Query()))
	}).Methods("GET")

 // rb:snippet domain.create
	r.HandleFunc("/domain/orders", func(w http.ResponseWriter, req *http.Request) {
		m, err := body(req)
		if err != nil {
			fail(w, err)
			return
		}
		v, err := d.ValidateOrder(m)
		if err != nil {
			fail(w, err)
			return
		}
		w.Header().Set("location", d.CreatedLocation())
		writeJSON(w, 201, v)
	}).Methods("POST")

 // rb:snippet domain.lookup errors.not_found
	r.HandleFunc("/domain/orders/{oid}", func(w http.ResponseWriter, req *http.Request) {
		v, err := d.GetOrder(mux.Vars(req)["oid"])
		send(w, v, err, 200)
	}).Methods("GET")

 // rb:snippet domain.replace
	r.HandleFunc("/domain/orders/{oid}", func(w http.ResponseWriter, req *http.Request) {
		o, err := d.GetOrder(mux.Vars(req)["oid"])
		if err != nil {
			fail(w, err)
			return
		}
		m, err := body(req)
		if err != nil {
			fail(w, err)
			return
		}
		v, err := d.ValidateOrder(m)
		if err != nil {
			fail(w, err)
			return
		}
		writeJSON(w, 200, d.ValidatedOrderWithID{ID: o.ID, ValidatedOrder: *v})
	}).Methods("PUT")

	r.HandleFunc("/domain/customers/{cid}/summary", func(w http.ResponseWriter, req *http.Request) {
		v, err := d.DomainJoin(mux.Vars(req)["cid"])
		send(w, v, err, 200)
	}).Methods("GET")

	r.HandleFunc("/domain/regions/{region}/report", func(w http.ResponseWriter, req *http.Request) {
		v, err := d.DomainAggregate(mux.Vars(req)["region"])
		send(w, v, err, 200)
	}).Methods("GET")

	r.HandleFunc("/domain/customers/{cid}", func(w http.ResponseWriter, req *http.Request) {
		m, err := body(req)
		if err != nil {
			fail(w, err)
			return
		}
		v, err := d.PatchCustomer(mux.Vars(req)["cid"], m)
		send(w, v, err, 200)
	}).Methods("PATCH")

	r.HandleFunc("/domain/orders/{oid}/lines/{lid}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		if _, err := d.GetOrderLine(vars["oid"], vars["lid"]); err != nil {
			fail(w, err)
			return
		}
		w.WriteHeader(204)
	}).Methods("DELETE")
}
