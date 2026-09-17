// RequestBench target: Echo. Framework wiring only; behaviour from _shared.
//
// One file per endpoint family. Go puts every file in a directory into one package, so the
// families sit beside main.go rather than under it; each exports a register function and
// nothing else is shared between them. Forty-five handlers in one file is a file nobody
// reads, and a family is the unit a rewiring or a rerun is scoped to.
//
// Every feature family uses Echo's own facility rather than an if in the handler, and each
// one is scoped to its own routes. Compression registered on the instance would put a "did
// they ask?" check on all forty-five endpoints and contaminate the rows the compressed
// family is measured against.
package main

import (
	"errors"
	"log"
	"net/http"
	"os"

	"github.com/labstack/echo/v4"
	hosts "github.com/ianjohnson/requestbench/targets/go/_hosts"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

func fail(c echo.Context, err error) error {
	if errors.Is(err, d.ErrNotFound) {
		return c.JSON(404, d.NotFoundBody())
	}
	return c.JSON(500, map[string]string{"error": "internal", "message": err.Error()})
}

func send(c echo.Context, v any, err error, status int) error {
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(status, v)
}

func main() {
	fx := os.Getenv("RB_FIXTURE")
	if fx == "" {
		fx = "../../spec/fixture.json"
	}
	if err := d.Load(fx); err != nil {
		log.Fatalf("fixture: %v", err)
	}

	e := echo.New()
	// The validator lives on the engine, so c.Validate is what runs it and no handler calls
	// a validator directly. That slot is Echo's validation facility.
	e.Validator = newValidator()
	// The renderer lives on the engine too, so c.Render is what reaches the template and no
	// handler calls a render function. That slot is Echo's view facility.
	e.Renderer = newRenderer()
	e.HideBanner = true
	e.HidePort = true

	// errors: the router's own miss and every failure a handler returns. Echo hands both
	// to one hook, which is what gives errors.unmatched the same body as errors.not_found.
	//
	// rb:snippet errors.unmatched
	e.HTTPErrorHandler = func(err error, c echo.Context) {
		if c.Response().Committed {
			return
		}
		var he *echo.HTTPError
		if errors.As(err, &he) && he.Code == http.StatusNotFound {
			_ = c.JSON(404, d.NotFoundBody())
			return
		}
		_ = fail(c, err)
	}

	registerBaseline(e)
	registerJSON(e)
	registerParameters(e)
	registerQuery(e)
	registerHeaders(e)
	registerMiddleware(e)
	registerAuthorized(e)
	registerCompressed(e)
	registerCached(e)
	registerBody(e)
	registerDomain(e)
	registerTemplate(e)

	hosts.Serve("echo", e, nil)
}
