package implementation

import (
	"encoding/json"
	"net/http"
	"strconv"
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
// The ServeMux answers a method the path has no pattern for with 405 and an Allow header.
func itemsRoutes(mux *http.ServeMux, p *Payloads) {
	// A GET pattern matches HEAD too, and net/http leaves the body unwritten.
	// rb:handler items.head
	mux.HandleFunc("GET /items/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.Atoi(r.PathValue("id"))
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
	})

	// Payload's json:"items" tag also reads as the route literal, so the route is marked.
	// rb:handler items.create
	mux.HandleFunc("POST /items", func(w http.ResponseWriter, r *http.Request) {
		var item NewItem
		if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
			refuse(w, err)
			return
		}
		created := item.at(p.Large.Count + 1)
		w.Header().Set("Location", "/items/"+strconv.Itoa(created.ID))
		respond(w, http.StatusCreated, created)
	})

	mux.HandleFunc("PUT /items/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.Atoi(r.PathValue("id"))
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
	})

	mux.HandleFunc("PATCH /items/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.Atoi(r.PathValue("id"))
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
	})

	mux.HandleFunc("DELETE /items/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.Atoi(r.PathValue("id"))
		if err != nil {
			refuse(w, err)
			return
		}
		if _, found := p.Row(id); !found {
			http.NotFound(w, r)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
}
