package implementation

import (
	"compress/gzip"
	"context"
	"io"
	"strconv"
	"strings"
	"sync"

	"github.com/danielgtaylor/huma/v2"
)

// compressedRoutes put the two operations in a group whose middleware gzips the answer with
// compress/gzip when the request asks for gzip, at the fastest level every framework here
// compresses at. Huma has no compression of its own.
func compressedRoutes(api huma.API, p *Payloads) {
	compressed := huma.NewGroup(api)
	compressed.UseMiddleware(gzipped)

	huma.Get(compressed, "/compressed/small", func(ctx context.Context, _ *struct{}) (*FreshOutput, error) { return fresh(&p.Small), nil })

	huma.Get(compressed, "/compressed/large", func(ctx context.Context, _ *struct{}) (*FreshOutput, error) { return fresh(&p.Large), nil })
}

// rb:wiring compressed.*
// writers holds gzip writers at the fastest level between answers. Reset points one at the next
// answer.
var writers = sync.Pool{New: func() any {
	w, _ := gzip.NewWriterLevel(nil, gzip.BestSpeed)
	return w
}}

// gzipped compresses what the handler writes when Accept-Encoding names gzip. Either way the
// answer says in Vary that it depends on Accept-Encoding.
func gzipped(ctx huma.Context, next func(huma.Context)) {
	ctx.AppendHeader("Vary", "Accept-Encoding")
	if !acceptsGzip(ctx.Header("Accept-Encoding")) {
		next(ctx)
		return
	}
	ctx.SetHeader("Content-Encoding", "gzip")
	zw := writers.Get().(*gzip.Writer)
	zw.Reset(ctx.BodyWriter())
	next(&gzipContext{humaContext: ctx, gzip: zw})
	_ = zw.Close()
	writers.Put(zw)
}

// gzipContext hands the handler a body writer that compresses.
type gzipContext struct {
	humaContext
	gzip *gzip.Writer
}

func (c *gzipContext) Unwrap() huma.Context { return c.humaContext }

func (c *gzipContext) BodyWriter() io.Writer { return c.gzip }

// acceptsGzip says whether an Accept-Encoding list names gzip with a weight above zero.
func acceptsGzip(accept string) bool {
	for coding := range strings.SplitSeq(accept, ",") {
		name, params, _ := strings.Cut(coding, ";")
		if !strings.EqualFold(strings.TrimSpace(name), "gzip") {
			continue
		}
		weight, weighted := strings.CutPrefix(strings.TrimSpace(params), "q=")
		if !weighted {
			return true
		}
		q, err := strconv.ParseFloat(weight, 64)
		return err == nil && q > 0
	}
	return false
}

// rb:end
