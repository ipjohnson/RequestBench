package implementation

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

type ParametersOne struct {
	One int `json:"one"`
}

type ParametersTwo struct {
	One int `json:"one"`
	Two int `json:"two"`
}

// parametersRoutes read router captures with chi.URLParam, which hands each back as a string,
// and convert them with strconv. chi's tree tries a static segment before a capture, so the
// static route wins its own path.
func parametersRoutes(r chi.Router, p *Payloads) {
	r.Get("/parameters/static/segment/literal", func(w http.ResponseWriter, r *http.Request) { render.JSON(w, r, &p.Small) })

	r.Get("/parameters/{one}/segment/literal", func(w http.ResponseWriter, r *http.Request) {
		one, err := strconv.Atoi(chi.URLParam(r, "one"))
		if err != nil {
			refuse(w, r, err)
			return
		}
		render.JSON(w, r, Echoed[ParametersOne]{&p.Small, ParametersOne{One: one}})
	})

	r.Get("/parameters/{one}/with-second/{two}", func(w http.ResponseWriter, r *http.Request) {
		one, err := strconv.Atoi(chi.URLParam(r, "one"))
		if err != nil {
			refuse(w, r, err)
			return
		}
		two, err := strconv.Atoi(chi.URLParam(r, "two"))
		if err != nil {
			refuse(w, r, err)
			return
		}
		render.JSON(w, r, Echoed[ParametersTwo]{&p.Small, ParametersTwo{One: one, Two: two}})
	})
}
