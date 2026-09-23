package implementation

import (
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
)

type ParametersOne struct {
	One int `json:"one"`
}

type ParametersTwo struct {
	One int `json:"one"`
	Two int `json:"two"`
}

// parametersRoutes read router captures with mux.Vars, which hands them back as strings, and
// convert them with strconv. mux tries routes in the order they are registered, and {one}
// matches the segment static as readily as a number, so the static route comes first.
func parametersRoutes(r *mux.Router, p *Payloads) {
	r.HandleFunc("/parameters/static/segment/literal", func(w http.ResponseWriter, r *http.Request) { respond(w, http.StatusOK, &p.Small) }).Methods(http.MethodGet)

	r.HandleFunc("/parameters/{one}/segment/literal", func(w http.ResponseWriter, r *http.Request) {
		one, err := strconv.Atoi(mux.Vars(r)["one"])
		if err != nil {
			refuse(w, err)
			return
		}
		respond(w, http.StatusOK, Echoed[ParametersOne]{&p.Small, ParametersOne{One: one}})
	}).Methods(http.MethodGet)

	r.HandleFunc("/parameters/{one}/with-second/{two}", func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		one, err := strconv.Atoi(vars["one"])
		if err != nil {
			refuse(w, err)
			return
		}
		two, err := strconv.Atoi(vars["two"])
		if err != nil {
			refuse(w, err)
			return
		}
		respond(w, http.StatusOK, Echoed[ParametersTwo]{&p.Small, ParametersTwo{One: one, Two: two}})
	}).Methods(http.MethodGet)
}
