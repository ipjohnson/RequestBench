package implementation

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/gorilla/schema"
)

// decoder is gorilla/schema's, one for the process as schema's README keeps one, because it
// caches what it learns about each struct.
var decoder = schema.NewDecoder()

type QueryOne struct {
	Page int `schema:"page" json:"page"`
}

// Search is query.many's eight values, which forms.urlencoded posts as a form.
type Search struct {
	Page     int    `schema:"page" json:"page"`
	Size     int    `schema:"size" json:"size"`
	Status   string `schema:"status" json:"status"`
	Category string `schema:"category" json:"category"`
	Sort     string `schema:"sort" json:"sort"`
	Q        string `schema:"q" json:"q"`
	MinPrice int    `schema:"minPrice" json:"minPrice"`
	MaxPrice int    `schema:"maxPrice" json:"maxPrice"`
}

// queryRoutes decode the query string with gorilla/schema, which fills the fields its schema
// tags name and converts each value to its field's type.
func queryRoutes(r *mux.Router, p *Payloads) {
	r.HandleFunc("/query/one", func(w http.ResponseWriter, r *http.Request) {
		var query QueryOne
		if err := decoder.Decode(&query, r.URL.Query()); err != nil {
			refuse(w, err)
			return
		}
		respond(w, http.StatusOK, Echoed[QueryOne]{&p.Small, query})
	}).Methods(http.MethodGet)

	r.HandleFunc("/query/many", func(w http.ResponseWriter, r *http.Request) {
		var query Search
		if err := decoder.Decode(&query, r.URL.Query()); err != nil {
			refuse(w, err)
			return
		}
		respond(w, http.StatusOK, Echoed[Search]{&p.Small, query})
	}).Methods(http.MethodGet)
}
