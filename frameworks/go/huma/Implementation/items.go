package implementation

import (
	"context"
	"net/http"
	"strconv"

	"github.com/danielgtaylor/huma/v2"
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
	PriceCents *int  `json:"priceCents,omitempty"`
	InStock    *bool `json:"inStock,omitempty"`
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

type ItemID struct {
	ID int `path:"id"`
}

type ItemOutput struct {
	Body Item
}

type CreatedOutput struct {
	Location string `header:"Location"`
	Body     Item
}

// itemsRoutes are every method on one resource over the rows of items.large. A measured row may
// not leave the server changed, so the writes store nothing and answer as if they had written.
// humago registers one ServeMux pattern per operation, and the ServeMux answers a method the path
// has no pattern for with 405 and an Allow header.
func itemsRoutes(api huma.API, p *Payloads) {
	row := func(id int) (Item, error) {
		found, ok := p.Row(id)
		if !ok {
			return Item{}, huma.Error404NotFound("no item has that id")
		}
		return found, nil
	}

	// A GET pattern matches HEAD too, and net/http leaves the body unwritten.
	// rb:handler items.head
	huma.Get(api, "/items/{id}", func(ctx context.Context, in *ItemID) (*ItemOutput, error) {
		found, err := row(in.ID)
		if err != nil {
			return nil, err
		}
		return &ItemOutput{Body: found}, nil
	})

	// Payload's json:"items" tag also reads as the route literal, so the route is marked.
	// rb:handler items.create
	huma.Post(api, "/items", func(ctx context.Context, in *struct{ Body NewItem }) (*CreatedOutput, error) {
		created := in.Body.at(p.Large.Count + 1)
		return &CreatedOutput{Location: "/items/" + strconv.Itoa(created.ID), Body: created}, nil
	}, func(o *huma.Operation) { o.DefaultStatus = http.StatusCreated })

	huma.Put(api, "/items/{id}", func(ctx context.Context, in *struct {
		ItemID
		Body NewItem
	}) (*ItemOutput, error) {
		return &ItemOutput{Body: in.Body.at(in.ID)}, nil
	})

	huma.Patch(api, "/items/{id}", func(ctx context.Context, in *struct {
		ItemID
		Body ItemPatch
	}) (*ItemOutput, error) {
		found, err := row(in.ID)
		if err != nil {
			return nil, err
		}
		return &ItemOutput{Body: in.Body.onto(found)}, nil
	})

	huma.Delete(api, "/items/{id}", func(ctx context.Context, in *ItemID) (*struct{}, error) {
		_, err := row(in.ID)
		return nil, err
	}, func(o *huma.Operation) { o.DefaultStatus = http.StatusNoContent })
}
