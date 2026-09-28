package implementation

import (
	"context"
	"net/http"
	"strconv"

	"github.com/danielgtaylor/huma/v2"
)

// corsRoutes put the /cors operation in a group whose middleware adds the CORS headers, and
// answers a preflight before any handler runs. Huma has no CORS of its own, so the middleware is
// written for it. The handler writes x-rb-serial, so its absence on a preflight shows the
// middleware answered alone.
func corsRoutes(api huma.API, p *Payloads) {
	crossOrigin := huma.NewGroup(api)
	crossOrigin.UseMiddleware(allowCrossOrigin(CorsPolicy{Origin: "https://shop.example.com", Method: "GET", Header: "x-rb-tenant", MaxAgeSeconds: 600}))

	// rb:handler cors.request,cors.vary
	huma.Get(crossOrigin, "/cors/small", func(ctx context.Context, _ *struct{}) (*FreshOutput, error) { return fresh(&p.Small), nil })

	// A preflight is an OPTIONS request, which reaches the group's middleware only through an
	// operation of its own. The middleware answers a preflight, so this handler answers only an
	// OPTIONS request that is not one.
	huma.Register(crossOrigin, huma.Operation{
		OperationID: "options-cors-small",
		Method:      http.MethodOptions,
		Path:        "/cors/small",
		Hidden:      true,
	}, func(ctx context.Context, _ *struct{}) (*struct{}, error) { return nil, nil })
}

// rb:wiring cors.*
// CorsPolicy is the one origin, method and header a cross-origin request may use, and how long a
// browser may keep the answer to its preflight.
type CorsPolicy struct {
	Origin        string
	Method        string
	Header        string
	MaxAgeSeconds int
}

// allowCrossOrigin answers a preflight itself, and lets every other request through to the
// handler. Only an answer to the allowed origin carries the CORS headers.
func allowCrossOrigin(policy CorsPolicy) func(huma.Context, func(huma.Context)) {
	maxAge := strconv.Itoa(policy.MaxAgeSeconds)
	return func(ctx huma.Context, next func(huma.Context)) {
		ctx.AppendHeader("Vary", "Origin")
		allowed := ctx.Header("Origin") == policy.Origin
		if allowed {
			ctx.SetHeader("Access-Control-Allow-Origin", policy.Origin)
		}
		if ctx.Method() != http.MethodOptions || ctx.Header("Access-Control-Request-Method") == "" {
			next(ctx)
			return
		}
		if allowed {
			ctx.SetHeader("Access-Control-Allow-Methods", policy.Method)
			ctx.SetHeader("Access-Control-Allow-Headers", policy.Header)
			ctx.SetHeader("Access-Control-Max-Age", maxAge)
		}
		ctx.SetStatus(http.StatusNoContent)
	}
}

// rb:end
