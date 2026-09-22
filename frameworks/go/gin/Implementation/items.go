package implementation

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
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
// Gin answers a method the path has no route for with its 404.
func itemsRoutes(r *gin.Engine, p *Payloads) {
	// Gin answers HEAD only where a route names it, and net/http leaves the body unwritten.
	// rb:handler items.read,items.head
	// rb:handler errors.not_found
	r.Match([]string{http.MethodGet, http.MethodHead}, "/items/:id", func(c *gin.Context) {
		var path itemID
		if err := c.ShouldBindUri(&path); err != nil {
			refuse(c, err)
			return
		}
		row, found := p.Row(path.ID)
		if !found {
			c.AbortWithStatus(http.StatusNotFound)
			return
		}
		c.JSON(http.StatusOK, row)
	})

	// Payload's json:"items" tag also reads as the route literal, so the route is marked.
	// rb:handler items.create
	r.POST("/items", func(c *gin.Context) {
		var item NewItem
		if err := c.ShouldBindJSON(&item); err != nil {
			refuse(c, err)
			return
		}
		created := item.at(p.Large.Count + 1)
		c.Header("Location", "/items/"+strconv.Itoa(created.ID))
		c.JSON(http.StatusCreated, created)
	})

	// rb:handler items.replace
	r.PUT("/items/:id", func(c *gin.Context) {
		var path itemID
		var item NewItem
		if err := c.ShouldBindUri(&path); err != nil {
			refuse(c, err)
			return
		}
		if err := c.ShouldBindJSON(&item); err != nil {
			refuse(c, err)
			return
		}
		c.JSON(http.StatusOK, item.at(path.ID))
	})

	// rb:handler items.update
	r.PATCH("/items/:id", func(c *gin.Context) {
		var path itemID
		var patch ItemPatch
		if err := c.ShouldBindUri(&path); err != nil {
			refuse(c, err)
			return
		}
		row, found := p.Row(path.ID)
		if !found {
			c.AbortWithStatus(http.StatusNotFound)
			return
		}
		if err := c.ShouldBindJSON(&patch); err != nil {
			refuse(c, err)
			return
		}
		c.JSON(http.StatusOK, patch.onto(row))
	})

	// rb:handler items.delete
	r.DELETE("/items/:id", func(c *gin.Context) {
		var path itemID
		if err := c.ShouldBindUri(&path); err != nil {
			refuse(c, err)
			return
		}
		if _, found := p.Row(path.ID); !found {
			c.AbortWithStatus(http.StatusNotFound)
			return
		}
		c.Status(http.StatusNoContent)
	})
}
