package implementation

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
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

// queryRoutes read the query string net/http parses into url.Values, and convert the numbers
// with strconv. net/http binds nothing into a struct.
func queryRoutes(mux *http.ServeMux, p *Payloads) {
	mux.HandleFunc("GET /query/one", func(w http.ResponseWriter, r *http.Request) {
		page, err := number(r.URL.Query(), "page")
		if err != nil {
			refuse(w, err)
			return
		}
		respond(w, http.StatusOK, Echoed[QueryOne]{&p.Small, QueryOne{Page: page}})
	})

	mux.HandleFunc("GET /query/many", func(w http.ResponseWriter, r *http.Request) {
		search, err := searchOf(r.URL.Query())
		if err != nil {
			refuse(w, err)
			return
		}
		respond(w, http.StatusOK, Echoed[Search]{&p.Small, search})
	})
}

// searchOf reads query.many's eight values from a query string or a form.
func searchOf(values url.Values) (Search, error) {
	page, pageErr := number(values, "page")
	size, sizeErr := number(values, "size")
	minPrice, minErr := number(values, "minPrice")
	maxPrice, maxErr := number(values, "maxPrice")
	if err := errors.Join(pageErr, sizeErr, minErr, maxErr); err != nil {
		return Search{}, err
	}
	return Search{
		Page:     page,
		Size:     size,
		Status:   values.Get("status"),
		Category: values.Get("category"),
		Sort:     values.Get("sort"),
		Q:        values.Get("q"),
		MinPrice: minPrice,
		MaxPrice: maxPrice,
	}, nil
}

// number reads one value as an integer, and names the value when it is not one.
func number(values url.Values, name string) (int, error) {
	n, err := strconv.Atoi(values.Get(name))
	if err != nil {
		return 0, fmt.Errorf("%s: %w", name, err)
	}
	return n, nil
}
