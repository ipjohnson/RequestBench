// query: query string parsing and coercion, isolated from any use of the values.
//
// chi has no binder to plug into: it routes net/http handlers, so r.URL.Query() is as far
// as the framework goes and the coercion is the handler's own work. This is this target's
// copy on purpose. Sharing one coercer across five frameworks measured the shared function
// rather than the framework, which is the defect #37 describes, and nothing else imports
// this file.
//
// A missing parameter and one that will not parse both coerce to the zero value, which is
// what a target with no binder can do without inventing an error contract the family does
// not have.
package main

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

type queryOne struct {
	Page int `json:"page"`
}

type queryMany struct {
	Page     int    `json:"page"`
	Size     int    `json:"size"`
	Status   string `json:"status"`
	Category string `json:"category"`
	Sort     string `json:"sort"`
	Q        string `json:"q"`
	MinPrice int    `json:"min_price"`
	MaxPrice int    `json:"max_price"`
}

func qstr(q map[string][]string, k string) string {
	if v, ok := q[k]; ok && len(v) > 0 {
		return v[0]
	}
	return ""
}

func qint(q map[string][]string, k string) int {
	n, err := strconv.Atoi(qstr(q, k))
	if err != nil {
		return 0
	}
	return n
}

func registerQuery(r chi.Router) {
	r.Get("/query/one", func(w http.ResponseWriter, req *http.Request) {
		q := req.URL.Query()
		writeJSON(w, 200, queryOne{Page: qint(q, "page")})
	})

	r.Get("/query/many", func(w http.ResponseWriter, req *http.Request) {
		q := req.URL.Query()
		writeJSON(w, 200, queryMany{
			Page: qint(q, "page"), Size: qint(q, "size"),
			Status: qstr(q, "status"), Category: qstr(q, "category"),
			Sort: qstr(q, "sort"), Q: qstr(q, "q"),
			MinPrice: qint(q, "min_price"), MaxPrice: qint(q, "max_price"),
		})
	})
}
