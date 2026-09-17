// domain: application-shaped handler work and the write methods.
package main

import (
	"github.com/gofiber/fiber/v3"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

func registerDomain(app *fiber.App) {
	app.Get("/domain/orders", func(c fiber.Ctx) error {
		return c.JSON(d.DomainFilter(query(c)))
	})

	app.Post("/domain/orders", func(c fiber.Ctx) error {
		ob, ok := bindOrder(c)
		if !ok {
			return nil
		}
		v := ob.order()
		c.Set("location", d.CreatedLocation())
		return c.Status(201).JSON(v)
	})

	app.Get("/domain/orders/:oid", func(c fiber.Ctx) error {
		v, err := d.GetOrder(c.Params("oid"))
		return send(c, v, err, 200)
	})

	app.Put("/domain/orders/:oid", func(c fiber.Ctx) error {
		o, err := d.GetOrder(c.Params("oid"))
		if err != nil {
			return fail(c, err)
		}
		ob, ok := bindOrder(c)
		if !ok {
			return nil
		}
		v := ob.order()
		return c.JSON(d.ValidatedOrderWithID{ID: o.ID, ValidatedOrder: *v})
	})

	app.Get("/domain/customers/:cid/summary", func(c fiber.Ctx) error {
		v, err := d.DomainJoin(c.Params("cid"))
		return send(c, v, err, 200)
	})

	app.Get("/domain/regions/:region/report", func(c fiber.Ctx) error {
		v, err := d.DomainAggregate(c.Params("region"))
		return send(c, v, err, 200)
	})

	app.Patch("/domain/customers/:cid", func(c fiber.Ctx) error {
		m, ok := bindAny(c)
		if !ok {
			return nil
		}
		v, err := d.PatchCustomer(c.Params("cid"), m)
		return send(c, v, err, 200)
	})

	app.Delete("/domain/orders/:oid/lines/:lid", func(c fiber.Ctx) error {
		if _, err := d.GetOrderLine(c.Params("oid"), c.Params("lid")); err != nil {
			return fail(c, err)
		}
		return c.SendStatus(204)
	})
}
