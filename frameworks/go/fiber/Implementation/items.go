package implementation

import (
	"strconv"

	"github.com/gofiber/fiber/v3"
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

type itemID struct {
	ID int `uri:"id"`
}

// itemsRoutes are every method on one resource over the rows of items.large. A measured row may
// not leave the server changed, so the writes store nothing and answer as if they had written.
// Fiber answers a method the path has no route for with 405.
func itemsRoutes(app *fiber.App, p *Payloads) {
	// Fiber registers a HEAD route beside every GET route, running the same handlers, and
	// fasthttp leaves the body unwritten.
	// rb:handler items.read,items.head
	// rb:handler errors.not_found
	app.Get("/items/:id", func(c fiber.Ctx) error {
		var path itemID
		if err := c.Bind().URI(&path); err != nil {
			return refuse(c, err)
		}
		row, found := p.Row(path.ID)
		if !found {
			return fiber.ErrNotFound
		}
		return c.JSON(row)
	})

	// Payload's json:"items" tag also reads as the route literal, so the route is marked.
	// rb:handler items.create
	app.Post("/items", func(c fiber.Ctx) error {
		var item NewItem
		if err := c.Bind().Body(&item); err != nil {
			return refuse(c, err)
		}
		created := item.at(p.Large.Count + 1)
		c.Location("/items/" + strconv.Itoa(created.ID))
		return c.Status(fiber.StatusCreated).JSON(created)
	})

	// rb:handler items.replace
	app.Put("/items/:id", func(c fiber.Ctx) error {
		var path itemID
		var item NewItem
		if err := c.Bind().URI(&path); err != nil {
			return refuse(c, err)
		}
		if err := c.Bind().Body(&item); err != nil {
			return refuse(c, err)
		}
		return c.JSON(item.at(path.ID))
	})

	// rb:handler items.update
	app.Patch("/items/:id", func(c fiber.Ctx) error {
		var path itemID
		var patch ItemPatch
		if err := c.Bind().URI(&path); err != nil {
			return refuse(c, err)
		}
		row, found := p.Row(path.ID)
		if !found {
			return fiber.ErrNotFound
		}
		if err := c.Bind().Body(&patch); err != nil {
			return refuse(c, err)
		}
		return c.JSON(patch.onto(row))
	})

	// rb:handler items.delete
	app.Delete("/items/:id", func(c fiber.Ctx) error {
		var path itemID
		if err := c.Bind().URI(&path); err != nil {
			return refuse(c, err)
		}
		if _, found := p.Row(path.ID); !found {
			return fiber.ErrNotFound
		}
		return c.SendStatus(fiber.StatusNoContent)
	})
}
