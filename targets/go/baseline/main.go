// RequestBench bare baseline for Go: net/http with the stdlib ServeMux. No dependencies.
// Everything else in the go shard is reported as a ratio to this.
package main

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"runtime"
	"strconv"

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

// recovered turns a panic into the 500 a framework's default handler would produce.
func recovered(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				msg := "internal"
				if e, ok := v.(error); ok {
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
	mux := http.NewServeMux()
	q := func(r *http.Request) map[string][]string { return r.URL.Query() }
	// Go only permits f(g()) when g's results are f's entire argument list, so lookups
	// route through a closure that returns the (value, error) pair verbatim.
	get := func(pattern string, fn func(*http.Request) (any, error)) {
		mux.HandleFunc(pattern, func(w http.ResponseWriter, r *http.Request) {
			v, err := fn(r)
			ok(w, v, err, 200)
		})
	}

	mux.HandleFunc("GET /plaintext", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("content-type", "text/plain")
		w.Write([]byte("Hello, World!"))
	})
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("content-type", "text/plain")
		w.Write([]byte("ok"))
	})
	mux.HandleFunc("GET /json/small", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, 200, d.JSONSmall())
	})
	mux.HandleFunc("GET /products", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, d.ListProducts(q(r)))
	})
	mux.HandleFunc("GET /customers", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, d.ListCustomers(q(r)))
	})
	mux.HandleFunc("GET /orders", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, d.ListOrders(q(r)))
	})
	mux.HandleFunc("GET /search", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, d.Search(q(r)))
	})
	mux.HandleFunc("GET /dashboard", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, 200, d.Dashboard())
	})
	mux.HandleFunc("GET /__meta", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, 200, map[string]string{"framework": "net/http",
			"version": runtime.Version(), "runtime": runtime.Version()})
	})
	mux.HandleFunc("GET /boom", func(http.ResponseWriter, *http.Request) { panic(d.Boom{}) })
	mux.HandleFunc("GET /forbidden", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, 403, map[string]string{"error": "forbidden"})
	})

	get("GET /products/{pid}", func(r *http.Request) (any, error) { return d.GetProduct(r.PathValue("pid")) })
	get("GET /customers/{cid}", func(r *http.Request) (any, error) { return d.GetCustomer(r.PathValue("cid")) })
	get("GET /orders/{oid}", func(r *http.Request) (any, error) { return d.GetOrder(r.PathValue("oid")) })
	get("GET /products/{pid}/reviews", func(r *http.Request) (any, error) { return d.GetProductReviews(r.PathValue("pid")) })
	get("GET /products/{pid}/related", func(r *http.Request) (any, error) { return d.RelatedProducts(r.PathValue("pid")) })
	get("GET /customers/{cid}/orders", func(r *http.Request) (any, error) { return d.GetCustomerOrders(r.PathValue("cid")) })
	get("GET /customers/{cid}/summary", func(r *http.Request) (any, error) { return d.CustomerSummary(r.PathValue("cid")) })
	get("GET /orders/{oid}/lines", func(r *http.Request) (any, error) { return d.GetOrderLines(r.PathValue("oid")) })
	get("GET /orders/{oid}/full", func(r *http.Request) (any, error) { return d.OrderFull(r.PathValue("oid")) })
	get("GET /regions/{r}/customers", func(r *http.Request) (any, error) { return d.GetRegionCustomers(r.PathValue("r")) })
	get("GET /regions/{r}/report", func(r *http.Request) (any, error) { return d.RegionReport(r.PathValue("r")) })
	get("GET /customers/{cid}/orders/{oid}", func(r *http.Request) (any, error) { return d.GetCustomerOrder(r.PathValue("cid"), r.PathValue("oid")) })
	get("GET /orders/{oid}/lines/{lid}", func(r *http.Request) (any, error) { return d.GetOrderLine(r.PathValue("oid"), r.PathValue("lid")) })
	get("GET /regions/{r}/customers/{cid}/orders/{oid}/lines/{lid}",
		func(r *http.Request) (any, error) {
			return d.GetOrderLine(r.PathValue("oid"), r.PathValue("lid"))
		})

	post := func(pattern string, fn func(map[string]any) (any, error), status int) {
		mux.HandleFunc(pattern, func(w http.ResponseWriter, r *http.Request) {
			m, err := body(r)
			if err != nil {
				fail(w, err)
				return
			}
			v, err := fn(m)
			ok(w, v, err, status)
		})
	}
	post("POST /orders/validate", func(m map[string]any) (any, error) { return d.ValidateOrder(m) }, 200)
	post("POST /customers/validate", func(m map[string]any) (any, error) { return d.ValidateCustomer(m) }, 200)
	post("POST /products/validate", func(m map[string]any) (any, error) { return d.ValidateProduct(m) }, 200)
	post("POST /echo", func(m map[string]any) (any, error) { return d.Echo(m), nil }, 200)
	mux.HandleFunc("POST /orders", func(w http.ResponseWriter, r *http.Request) {
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

	mux.HandleFunc("POST /orders/{oid}/lines", func(w http.ResponseWriter, r *http.Request) {
		o, err := d.GetOrder(r.PathValue("oid"))
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
		w.Header().Set("location",
			"/orders/"+r.PathValue("oid")+"/lines/"+strconv.Itoa(len(o.Lines)+1))
		ok(w, v, err, 201)
	})
	mux.HandleFunc("PUT /orders/{oid}", func(w http.ResponseWriter, r *http.Request) {
		o, err := d.GetOrder(r.PathValue("oid"))
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
	mux.HandleFunc("PATCH /customers/{cid}", func(w http.ResponseWriter, r *http.Request) {
		m, err := body(r)
		if err != nil {
			fail(w, err)
			return
		}
		v, err := d.PatchCustomer(r.PathValue("cid"), m)
		ok(w, v, err, 200)
	})
	mux.HandleFunc("DELETE /orders/{oid}/lines/{lid}", func(w http.ResponseWriter, r *http.Request) {
		if _, err := d.GetOrderLine(r.PathValue("oid"), r.PathValue("lid")); err != nil {
			fail(w, err)
			return
		}
		w.WriteHeader(204)
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, 404, map[string]string{"error": "not_found"})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("go baseline listening on %s", port)
	log.Fatal(http.ListenAndServe(":"+port, recovered(mux)))
}
