// domain: application-shaped handler work and the write methods.
package main

import (
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
	"github.com/labstack/echo/v4"
)

func registerDomain(e *echo.Echo) {
	e.GET("/domain/orders", func(c echo.Context) error {
		var f orderFilter
		if !bindQuery(c, &f) {
			return nil
		}
		return c.JSON(200, d.DomainFilter(f.Page, f.Size, f.Status))
	})

	e.POST("/domain/orders", func(c echo.Context) error {
		ob, ok := bindOrder(c)
		if !ok {
			return nil
		}
		v := ob.order()
		c.Response().Header().Set("location", d.CreatedLocation())
		return c.JSON(201, v)
	})

	e.GET("/domain/orders/:oid", func(c echo.Context) error {
		v, err := d.GetOrder(c.Param("oid"))
		return send(c, v, err, 200)
	})

	e.PUT("/domain/orders/:oid", func(c echo.Context) error {
		o, err := d.GetOrder(c.Param("oid"))
		if err != nil {
			return fail(c, err)
		}
		ob, ok := bindOrder(c)
		if !ok {
			return nil
		}
		v := ob.order()
		return c.JSON(200, d.ValidatedOrderWithID{ID: o.ID, ValidatedOrder: *v})
	})

	e.GET("/domain/customers/:cid/summary", func(c echo.Context) error {
		v, err := d.DomainJoin(c.Param("cid"))
		return send(c, v, err, 200)
	})

	e.GET("/domain/regions/:region/report", func(c echo.Context) error {
		v, err := d.DomainAggregate(c.Param("region"))
		return send(c, v, err, 200)
	})

	e.PATCH("/domain/customers/:cid", func(c echo.Context) error {
		m, ok := bindAny(c)
		if !ok {
			return nil
		}
		v, err := d.PatchCustomer(c.Param("cid"), m)
		return send(c, v, err, 200)
	})

	e.DELETE("/domain/orders/:oid/lines/:lid", func(c echo.Context) error {
		if _, err := d.GetOrderLine(c.Param("oid"), c.Param("lid")); err != nil {
			return fail(c, err)
		}
		return c.NoContent(204)
	})
}
