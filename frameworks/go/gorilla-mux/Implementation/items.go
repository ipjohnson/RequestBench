package implementation

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
)

// NewItem is an item as a client creates or replaces one.
type NewItem struct {
	Name       string `json:"name"`
	Category   string `json:"category"`
	PriceCents int    `json:"priceCents"`
	InStock    bool   `json:"inStock"`
}

func (n NewItem) at(id int) Item {
	return Item{ID: id, Name: n.Name, Category: n.Category, PriceCents: n.PriceCents, InStock: n.InStock}
}

// ItemPatch is the two fields items.update changes. A field the body leaves out stays nil.
type ItemPatch struct {
	PriceCents *int  `json:"priceCents"`
	InStock    *bool `json:"inStock"`
}

func (patch ItemPatch) onto(row Item) Item {
	if patch.PriceCents != nil {
		row.PriceCents = *patch.PriceCents
	}
	if patch.InStock != nil {
		row.InStock = *patch.InStock
	}
	return row
}

// itemsRoutes are every method on one resource over the rows of items.large. A measured row may
// not leave the server changed, so the writes store nothing and answer as if they had written.
// mux answers a method the path has no route for with 405.
func itemsRoutes(r *mux.Router, p *Payloads) {
	// mux answers HEAD only where a route names it, and net/http leaves the body unwritten.
	// rb:handler items.read,items.head
	// rb:handler errors.not_found
	r.HandleFunc("/items/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.Atoi(mux.Vars(r)["id"])
		if err != nil {
			refuse(w, err)
			return
		}
		row, found := p.Row(id)
		if !found {
			http.NotFound(w, r)
			return
		}
		respond(w, http.StatusOK, row)
	}).Methods(http.MethodGet, http.MethodHead)

	// Payload's json:"items" tag also reads as the route literal, so the route is marked.
	// rb:handler items.create
	r.HandleFunc("/items", func(w http.ResponseWriter, r *http.Request) {
		var item NewItem
		if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
			refuse(w, err)
			return
		}
		created := item.at(p.Large.Count + 1)
		w.Header().Set("Location", "/items/"+strconv.Itoa(created.ID))
		respond(w, http.StatusCreated, created)
	}).Methods(http.MethodPost)

	// rb:handler items.replace
	r.HandleFunc("/items/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.Atoi(mux.Vars(r)["id"])
		if err != nil {
			refuse(w, err)
			return
		}
		var item NewItem
		if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
			refuse(w, err)
			return
		}
		respond(w, http.StatusOK, item.at(id))
	}).Methods(http.MethodPut)

	// rb:handler items.update
	r.HandleFunc("/items/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.Atoi(mux.Vars(r)["id"])
		if err != nil {
			refuse(w, err)
			return
		}
		row, found := p.Row(id)
		if !found {
			http.NotFound(w, r)
			return
		}
		var patch ItemPatch
		if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
			refuse(w, err)
			return
		}
		respond(w, http.StatusOK, patch.onto(row))
	}).Methods(http.MethodPatch)

	// rb:handler items.delete
	r.HandleFunc("/items/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.Atoi(mux.Vars(r)["id"])
		if err != nil {
			refuse(w, err)
			return
		}
		if _, found := p.Row(id); !found {
			http.NotFound(w, r)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}).Methods(http.MethodDelete)
}
