package implementation

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

// NewItem is an item as a client creates or replaces one.
type NewItem struct {
	Name       string `json:"name"`
	Category   string `json:"category"`
	PriceCents int    `json:"priceCents"`
	InStock    bool   `json:"inStock"`
}

func (n *NewItem) Bind(*http.Request) error { return nil }

func (n NewItem) at(id int) Item {
	return Item{ID: id, Name: n.Name, Category: n.Category, PriceCents: n.PriceCents, InStock: n.InStock}
}

// ItemPatch is the two fields items.update changes. A field the body leaves out stays nil.
type ItemPatch struct {
	PriceCents *int  `json:"priceCents"`
	InStock    *bool `json:"inStock"`
}

func (patch *ItemPatch) Bind(*http.Request) error { return nil }

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
// chi answers a method the path has no route for with 405.
func itemsRoutes(r chi.Router, p *Payloads) {
	// rb:handler items.read,items.head
	// rb:handler errors.not_found
	read := func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.Atoi(chi.URLParam(r, "id"))
		if err != nil {
			refuse(w, r, err)
			return
		}
		row, found := p.Row(id)
		if !found {
			_ = render.Render(w, r, ErrNotFound)
			return
		}
		render.JSON(w, r, row)
	}

	r.Get("/items/{id}", read)

	// chi answers HEAD only where a route names it, and net/http leaves the body unwritten.
	r.Head("/items/{id}", read)

	// Payload's json:"items" tag also reads as the route literal, so the route is marked.
	// rb:handler items.create
	r.Post("/items", func(w http.ResponseWriter, r *http.Request) {
		var item NewItem
		if err := render.Bind(r, &item); err != nil {
			refuse(w, r, err)
			return
		}
		created := item.at(p.Large.Count + 1)
		w.Header().Set("Location", "/items/"+strconv.Itoa(created.ID))
		render.Status(r, http.StatusCreated)
		render.JSON(w, r, created)
	})

	// rb:handler items.replace
	r.Put("/items/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.Atoi(chi.URLParam(r, "id"))
		if err != nil {
			refuse(w, r, err)
			return
		}
		var item NewItem
		if err := render.Bind(r, &item); err != nil {
			refuse(w, r, err)
			return
		}
		render.JSON(w, r, item.at(id))
	})

	// rb:handler items.update
	r.Patch("/items/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.Atoi(chi.URLParam(r, "id"))
		if err != nil {
			refuse(w, r, err)
			return
		}
		row, found := p.Row(id)
		if !found {
			_ = render.Render(w, r, ErrNotFound)
			return
		}
		var patch ItemPatch
		if err := render.Bind(r, &patch); err != nil {
			refuse(w, r, err)
			return
		}
		render.JSON(w, r, patch.onto(row))
	})

	// rb:handler items.delete
	r.Delete("/items/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.Atoi(chi.URLParam(r, "id"))
		if err != nil {
			refuse(w, r, err)
			return
		}
		if _, found := p.Row(id); !found {
			_ = render.Render(w, r, ErrNotFound)
			return
		}
		render.NoContent(w, r)
	})
}
