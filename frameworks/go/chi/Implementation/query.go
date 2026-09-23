package implementation

import (
	"net/http"
	"net/url"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

type QueryOne struct {
	Page int `json:"page"`
}

// Search is query.many's eight values, which forms.urlencoded posts as a form.
type Search struct {
	Page     int    `json:"page"`
	Size     int    `json:"size"`
	Status   string `json:"status"`
	Category string `json:"category"`
	Sort     string `json:"sort"`
	Q        string `json:"q"`
	MinPrice int    `json:"minPrice"`
	MaxPrice int    `json:"maxPrice"`
}

// queryRoutes read the query string net/http parsed. chi binds nothing, so each number is
// converted with strconv.
func queryRoutes(r chi.Router, p *Payloads) {
	r.Get("/query/one", func(w http.ResponseWriter, r *http.Request) {
		page, err := strconv.Atoi(r.URL.Query().Get("page"))
		if err != nil {
			refuse(w, r, err)
			return
		}
		render.JSON(w, r, Echoed[QueryOne]{&p.Small, QueryOne{Page: page}})
	})

	r.Get("/query/many", func(w http.ResponseWriter, r *http.Request) {
		search, err := searchOf(r.URL.Query())
		if err != nil {
			refuse(w, r, err)
			return
		}
		render.JSON(w, r, Echoed[Search]{&p.Small, search})
	})
}

// searchOf reads a Search from query or form values.
func searchOf(values url.Values) (Search, error) {
	search := Search{
		Status:   values.Get("status"),
		Category: values.Get("category"),
		Sort:     values.Get("sort"),
		Q:        values.Get("q"),
	}
	for _, number := range []struct {
		name string
		into *int
	}{
		{"page", &search.Page},
		{"size", &search.Size},
		{"minPrice", &search.MinPrice},
		{"maxPrice", &search.MaxPrice},
	} {
		value, err := strconv.Atoi(values.Get(number.name))
		if err != nil {
			return Search{}, err
		}
		*number.into = value
	}
	return search, nil
}
