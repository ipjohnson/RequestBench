// domain: application-shaped handler work and the write methods.
package main

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

func registerDomain(r chi.Router) {
	r.Get("/domain/orders", func(w http.ResponseWriter, req *http.Request) {
		q := req.URL.Query()
		writeJSON(w, 200, d.DomainFilter(qint(q, "page"), qint(q, "size"), qstr(q, "status")))
	})

	r.Post("/domain/orders", func(w http.ResponseWriter, req *http.Request) {
		m, ok := body(w, req)
		if !ok {
			return
		}
		v, errs := validateOrder(m, false)
		if errs != nil {
			writeJSON(w, 422, invalidBody(errs))
			return
		}
		w.Header().Set("location", d.CreatedLocation())
		writeJSON(w, 201, v)
	})

	r.Get("/domain/orders/{oid}", func(w http.ResponseWriter, req *http.Request) {
		v, err := d.GetOrder(chi.URLParam(req, "oid"))
		send(w, v, err, 200)
	})

	r.Put("/domain/orders/{oid}", func(w http.ResponseWriter, req *http.Request) {
		o, err := d.GetOrder(chi.URLParam(req, "oid"))
		if err != nil {
			fail(w, err)
			return
		}
		m, ok := body(w, req)
		if !ok {
			return
		}
		v, errs := validateOrder(m, false)
		if errs != nil {
			writeJSON(w, 422, invalidBody(errs))
			return
		}
		writeJSON(w, 200, d.ValidatedOrderWithID{ID: o.ID, ValidatedOrder: *v})
	})

	r.Get("/domain/customers/{cid}/summary", func(w http.ResponseWriter, req *http.Request) {
		v, err := d.DomainJoin(chi.URLParam(req, "cid"))
		send(w, v, err, 200)
	})

	r.Get("/domain/regions/{region}/report", func(w http.ResponseWriter, req *http.Request) {
		v, err := d.DomainAggregate(chi.URLParam(req, "region"))
		send(w, v, err, 200)
	})

	r.Patch("/domain/customers/{cid}", func(w http.ResponseWriter, req *http.Request) {
		m, ok := body(w, req)
		if !ok {
			return
		}
		v, err := d.PatchCustomer(chi.URLParam(req, "cid"), m)
		send(w, v, err, 200)
	})

	r.Delete("/domain/orders/{oid}/lines/{lid}", func(w http.ResponseWriter, req *http.Request) {
		if _, err := d.GetOrderLine(chi.URLParam(req, "oid"), chi.URLParam(req, "lid")); err != nil {
			fail(w, err)
			return
		}
		w.WriteHeader(204)
	})
}
