package implementation

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v5"
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
	ID int `param:"id"`
}

// itemsRoutes are every method on one resource over the rows of items.large. A measured row may
// not leave the server changed, so the writes store nothing and answer as if they had written.
// Echo answers a method the path has no route for with 405.
func itemsRoutes(e *echo.Echo, p *Payloads) {
	// rb:handler items.read,items.head
	// rb:handler errors.not_found
	read := func(c *echo.Context) error {
		var path itemID
		if err := echo.BindPathValues(c, &path); err != nil {
			return err
		}
		row, found := p.Row(path.ID)
		if !found {
			return echo.ErrNotFound
		}
		return c.JSON(http.StatusOK, row)
	}

	e.GET("/items/:id", read)

	// Echo's router answers HEAD only where a route names it, and net/http leaves the body unwritten.
	e.HEAD("/items/:id", read)

	// Payload's json:"items" tag also reads as the route literal, so the route is marked.
	// rb:handler items.create
	e.POST("/items", func(c *echo.Context) error {
		var item NewItem
		if err := c.Bind(&item); err != nil {
			return err
		}
		created := item.at(p.Large.Count + 1)
		c.Response().Header().Set(echo.HeaderLocation, "/items/"+strconv.Itoa(created.ID))
		return c.JSON(http.StatusCreated, created)
	})

	// rb:handler items.replace
	e.PUT("/items/:id", func(c *echo.Context) error {
		var path itemID
		var item NewItem
		if err := echo.BindPathValues(c, &path); err != nil {
			return err
		}
		if err := c.Bind(&item); err != nil {
			return err
		}
		return c.JSON(http.StatusOK, item.at(path.ID))
	})

	// rb:handler items.update
	e.PATCH("/items/:id", func(c *echo.Context) error {
		var path itemID
		var patch ItemPatch
		if err := echo.BindPathValues(c, &path); err != nil {
			return err
		}
		row, found := p.Row(path.ID)
		if !found {
			return echo.ErrNotFound
		}
		if err := c.Bind(&patch); err != nil {
			return err
		}
		return c.JSON(http.StatusOK, patch.onto(row))
	})

	// rb:handler items.delete
	e.DELETE("/items/:id", func(c *echo.Context) error {
		var path itemID
		if err := echo.BindPathValues(c, &path); err != nil {
			return err
		}
		if _, found := p.Row(path.ID); !found {
			return echo.ErrNotFound
		}
		return c.NoContent(http.StatusNoContent)
	})
}
