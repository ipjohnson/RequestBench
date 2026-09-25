package implementation

import (
	"net/http"
	"strconv"
)

type ParametersOne struct {
	One int `json:"one"`
}

type ParametersTwo struct {
	One int `json:"one"`
	Two int `json:"two"`
}

// parametersRoutes read the pattern's wildcards with PathValue, which hands them back as strings,
// and convert them with strconv. The literal static segment is more specific than the {one}
// wildcard, so the ServeMux answers it with its own route.
func parametersRoutes(mux *http.ServeMux, p *Payloads) {
	mux.HandleFunc("GET /parameters/static/segment/literal", func(w http.ResponseWriter, r *http.Request) { respond(w, http.StatusOK, &p.Small) })

	mux.HandleFunc("GET /parameters/{one}/segment/literal", func(w http.ResponseWriter, r *http.Request) {
		one, err := strconv.Atoi(r.PathValue("one"))
		if err != nil {
			refuse(w, err)
			return
		}
		respond(w, http.StatusOK, Echoed[ParametersOne]{&p.Small, ParametersOne{One: one}})
	})

	mux.HandleFunc("GET /parameters/{one}/with-second/{two}", func(w http.ResponseWriter, r *http.Request) {
		one, err := strconv.Atoi(r.PathValue("one"))
		if err != nil {
			refuse(w, err)
			return
		}
		two, err := strconv.Atoi(r.PathValue("two"))
		if err != nil {
			refuse(w, err)
			return
		}
		respond(w, http.StatusOK, Echoed[ParametersTwo]{&p.Small, ParametersTwo{One: one, Two: two}})
	})
}
