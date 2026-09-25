package implementation

import (
	"context"
	"runtime"
	"runtime/debug"
	"strings"

	"github.com/danielgtaylor/huma/v2"
)

// Adapter names what hands the application its requests. It is Huma's humago adapter over
// net/http's server unless the host's main package says otherwise.
var Adapter = "humago"

// TextOutput answers bytes as they are, under the content type it names.
type TextOutput struct {
	ContentType string `header:"Content-Type"`
	Body        []byte
}

// contractRoutes answer /health and /__meta, which the contract asks of every framework outside the
// corpus. They are hidden from the OpenAPI document, which describes the corpus.
func contractRoutes(api huma.API) {
	hidden := func(o *huma.Operation) { o.Hidden = true }

	// The payloads are loaded before the server listens, so a server that answers has them.
	huma.Get(api, "/health", func(ctx context.Context, _ *struct{}) (*TextOutput, error) {
		return &TextOutput{ContentType: "text/plain; charset=utf-8", Body: []byte("ok")}, nil
	}, hidden)

	type MetaOutput struct {
		Body map[string]any
	}
	version := moduleVersion("github.com/danielgtaylor/huma/v2")
	huma.Get(api, "/__meta", func(ctx context.Context, _ *struct{}) (*MetaOutput, error) {
		return &MetaOutput{Body: map[string]any{
			"framework":  "Huma",
			"version":    version,
			"runtime":    runtime.Version(),
			"adapter":    Adapter,
			"serializer": "encoding/json",
			// Go sets this from the container's CPU quota, so it says how many threads run Go code.
			"gomaxprocs": runtime.GOMAXPROCS(0),
		}}, nil
	}, hidden)
}

// moduleVersion is the version of a module the build resolved, without the v Go puts in front of it.
func moduleVersion(path string) string {
	if info, ok := debug.ReadBuildInfo(); ok {
		for _, dep := range info.Deps {
			if dep.Path == path {
				return strings.TrimPrefix(dep.Version, "v")
			}
		}
	}
	return "unknown"
}
