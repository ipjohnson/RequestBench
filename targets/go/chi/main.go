// RequestBench target: chi. Framework wiring only; behaviour from _shared.
package main

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"runtime"
	"strconv"

	"github.com/go-chi/chi/v5"
	hosts "github.com/ianjohnson/requestbench/targets/go/_hosts"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	buf, err := json.Marshal(v)
	if err != nil {
		w.WriteHeader(500)
		return
	}
	w.Header().Set("content-type", "application/json")
	w.Header().Set("content-length", strconv.Itoa(len(buf)))
	w.WriteHeader(status)
	w.Write(buf)
}

func fail(w http.ResponseWriter, err error) {
	var ve *d.ValidationError
	switch {
	case errors.Is(err, d.ErrNotFound):
		writeJSON(w, 404, map[string]string{"error": "not_found"})
	case errors.As(err, &ve):
		writeJSON(w, 422, map[string]any{"error": "validation_failed", "errors": ve.Errors})
	default:
		writeJSON(w, 500, map[string]string{"error": "internal", "message": err.Error()})
	}
}

func ok(w http.ResponseWriter, v any, err error, status int) {
	if err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, status, v)
}

func body(r *http.Request) (map[string]any, error) {
	var m map[string]any
	if err := json.NewDecoder(r.Body).Decode(&m); err != nil {
		return nil, &d.ValidationError{Errors: []d.FieldError{{Field: "body", Rule: "json"}}}
	}
	return m, nil
}

// recovered turns a panic into the 500 every other target produces.
func recovered(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				msg := "internal"
				if e, isErr := v.(error); isErr {
					msg = e.Error()
				}
				writeJSON(w, 500, map[string]string{"error": "internal", "message": msg})
			}
		}()
		h.ServeHTTP(w, r)
	})
}

func main() {
	fx := os.Getenv("RB_FIXTURE")
	if fx == "" {
		fx = "../../spec/fixture.json"
	}
	if err := d.Load(fx); err != nil {
		log.Fatalf("fixture: %v", err)
	}
	r := chi.NewRouter()
	P := chi.URLParam
	q := func(r *http.Request) map[string][]string { return r.URL.Query() }

	get := func(path string, fn func(*http.Request) (any, error)) {
		r.Get(path, func(w http.ResponseWriter, r *http.Request) {
			v, err := fn(r)
			ok(w, v, err, 200)
		})
	}

	r.Get("/plaintext", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("content-type", "text/plain")
		w.Write([]byte("Hello, World!"))
	})
	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("content-type", "text/plain")
		w.Write([]byte("ok"))
	})
	get("/__meta", func(*http.Request) (any, error) {
		return map[string]string{"framework": "chi", "version": chiVersion(),
			"runtime": runtime.Version()}, nil
	})
	get("/json/small", func(*http.Request) (any, error) { return d.JSONSmall(), nil })
	get("/products", func(r *http.Request) (any, error) { return d.ListProducts(q(r)), nil })
	get("/customers", func(r *http.Request) (any, error) { return d.ListCustomers(q(r)), nil })
	get("/orders", func(r *http.Request) (any, error) { return d.ListOrders(q(r)), nil })
	get("/search", func(r *http.Request) (any, error) { return d.Search(q(r)), nil })
	get("/dashboard", func(*http.Request) (any, error) { return d.Dashboard(), nil })
	r.Get("/boom", func(http.ResponseWriter, *http.Request) { panic(d.Boom{}) })
	r.Get("/forbidden", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, 403, map[string]string{"error": "forbidden"})
	})

	get("/products/{pid}", func(r *http.Request) (any, error) { return d.GetProduct(P(r, "pid")) })
	get("/customers/{cid}", func(r *http.Request) (any, error) { return d.GetCustomer(P(r, "cid")) })
	get("/orders/{oid}", func(r *http.Request) (any, error) { return d.GetOrder(P(r, "oid")) })
	get("/products/{pid}/reviews", func(r *http.Request) (any, error) { return d.GetProductReviews(P(r, "pid")) })
	get("/products/{pid}/related", func(r *http.Request) (any, error) { return d.RelatedProducts(P(r, "pid")) })
	get("/customers/{cid}/orders", func(r *http.Request) (any, error) { return d.GetCustomerOrders(P(r, "cid")) })
	get("/customers/{cid}/summary", func(r *http.Request) (any, error) { return d.CustomerSummary(P(r, "cid")) })
	get("/orders/{oid}/lines", func(r *http.Request) (any, error) { return d.GetOrderLines(P(r, "oid")) })
	get("/orders/{oid}/full", func(r *http.Request) (any, error) { return d.OrderFull(P(r, "oid")) })
	get("/regions/{r}/customers", func(r *http.Request) (any, error) { return d.GetRegionCustomers(P(r, "r")) })
	get("/regions/{r}/report", func(r *http.Request) (any, error) { return d.RegionReport(P(r, "r")) })
	get("/customers/{cid}/orders/{oid}", func(r *http.Request) (any, error) {
		return d.GetCustomerOrder(P(r, "cid"), P(r, "oid"))
	})
	get("/orders/{oid}/lines/{lid}", func(r *http.Request) (any, error) {
		return d.GetOrderLine(P(r, "oid"), P(r, "lid"))
	})
	get("/regions/{r}/customers/{cid}/orders/{oid}/lines/{lid}", func(r *http.Request) (any, error) {
		return d.GetOrderLine(P(r, "oid"), P(r, "lid"))
	})

	post := func(path string, fn func(map[string]any) (any, error), status int) {
		r.Post(path, func(w http.ResponseWriter, r *http.Request) {
			m, err := body(r)
			if err != nil {
				fail(w, err)
				return
			}
			v, err := fn(m)
			ok(w, v, err, status)
		})
	}
	post("/orders/validate", func(m map[string]any) (any, error) { return d.ValidateOrder(m) }, 200)
	post("/customers/validate", func(m map[string]any) (any, error) { return d.ValidateCustomer(m) }, 200)
	post("/products/validate", func(m map[string]any) (any, error) { return d.ValidateProduct(m) }, 200)
	post("/echo", func(m map[string]any) (any, error) { return d.Echo(m), nil }, 200)

	r.Post("/orders", func(w http.ResponseWriter, r *http.Request) {
		m, err := body(r)
		if err != nil {
			fail(w, err)
			return
		}
		v, err := d.ValidateOrder(m)
		if err != nil {
			fail(w, err)
			return
		}
		w.Header().Set("location", "/orders/"+strconv.Itoa(d.NextOrderID))
		writeJSON(w, 201, v)
	})
	r.Post("/orders/{oid}/lines", func(w http.ResponseWriter, r *http.Request) {
		o, err := d.GetOrder(P(r, "oid"))
		if err != nil {
			fail(w, err)
			return
		}
		m, err := body(r)
		if err != nil {
			fail(w, err)
			return
		}
		v, err := d.ValidateLine(m)
		w.Header().Set("location", "/orders/"+P(r, "oid")+"/lines/"+strconv.Itoa(len(o.Lines)+1))
		ok(w, v, err, 201)
	})
	r.Put("/orders/{oid}", func(w http.ResponseWriter, r *http.Request) {
		o, err := d.GetOrder(P(r, "oid"))
		if err != nil {
			fail(w, err)
			return
		}
		m, err := body(r)
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
	})
	r.Patch("/customers/{cid}", func(w http.ResponseWriter, r *http.Request) {
		m, err := body(r)
		if err != nil {
			fail(w, err)
			return
		}
		v, err := d.PatchCustomer(P(r, "cid"), m)
		ok(w, v, err, 200)
	})
	r.Delete("/orders/{oid}/lines/{lid}", func(w http.ResponseWriter, r *http.Request) {
		if _, err := d.GetOrderLine(P(r, "oid"), P(r, "lid")); err != nil {
			fail(w, err)
			return
		}
		w.WriteHeader(204)
	})

	r.NotFound(func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, 404, map[string]string{"error": "not_found"})
	})
	r.MethodNotAllowed(func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, 404, map[string]string{"error": "not_found"})
	})

	hosts.Serve("chi", recovered(r))
}
