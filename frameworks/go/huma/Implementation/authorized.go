package implementation

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// authorizedRoutes put the operation in a group whose middleware refuses any bearer token but
// the one it is given, as Huma's groups page puts an auth middleware on a group. The operation
// declares the bearer scheme, so the OpenAPI document says it needs a token.
func authorizedRoutes(api huma.API, p *Payloads) {
	components := api.OpenAPI().Components
	if components.SecuritySchemes == nil {
		components.SecuritySchemes = map[string]*huma.SecurityScheme{}
	}
	components.SecuritySchemes["bearer"] = &huma.SecurityScheme{Type: "http", Scheme: "bearer"}

	authorized := huma.NewGroup(api)
	authorized.UseMiddleware(requireToken(api, "5a7cc77ed0dcb825806b6f872026c317"))

	huma.Get(authorized, "/authorized/small", func(ctx context.Context, _ *struct{}) (*PayloadOutput, error) {
		return &PayloadOutput{Body: &p.Small}, nil
	}, func(o *huma.Operation) { o.Security = []map[string][]string{{"bearer": {}}} })
}

// rb:wiring authorized.*
// requireToken refuses any other Authorization with Huma's own 403, and hands the rest on.
func requireToken(api huma.API, token string) func(huma.Context, func(huma.Context)) {
	expected := "Bearer " + token
	return func(ctx huma.Context, next func(huma.Context)) {
		if ctx.Header("Authorization") != expected {
			_ = huma.WriteErr(api, ctx, http.StatusForbidden, "Forbidden")
			return
		}
		next(ctx)
	}
}
