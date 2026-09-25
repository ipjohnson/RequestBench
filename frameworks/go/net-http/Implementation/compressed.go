package implementation

import (
	"compress/gzip"
	"net/http"
	"strconv"
	"strings"
	"sync"
)

// compressedRoutes answer like any other. net/http compresses no answer, so the handler wrapped
// around each /compressed route gzips it with compress/gzip when the request asks for gzip, at the
// fastest level every framework here compresses at.
func compressedRoutes(mux *http.ServeMux, p *Payloads) {
	mux.Handle("GET /compressed/small", gzipped(fresh(&p.Small)))

	mux.Handle("GET /compressed/large", gzipped(fresh(&p.Large)))
}

// rb:wiring compressed.*
// writers are gzip writers at the fastest level, kept for the next answer, which Reset points
// one at.
var writers = sync.Pool{New: func() any {
	w, _ := gzip.NewWriterLevel(nil, gzip.BestSpeed)
	return w
}}

// gzipped compresses what the handler writes when Accept-Encoding names gzip. Either way the
// answer says in Vary that it depends on Accept-Encoding.
func gzipped(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Vary", "Accept-Encoding")
		if !acceptsGzip(r.Header.Get("Accept-Encoding")) {
			next.ServeHTTP(w, r)
			return
		}
		w.Header().Set("Content-Encoding", "gzip")
		zw := writers.Get().(*gzip.Writer)
		zw.Reset(w)
		next.ServeHTTP(&gzipWriter{ResponseWriter: w, gzip: zw}, r)
		_ = zw.Close()
		writers.Put(zw)
	})
}

// gzipWriter sends what a handler writes through a gzip writer.
type gzipWriter struct {
	http.ResponseWriter
	gzip *gzip.Writer
}

func (w *gzipWriter) Write(data []byte) (int, error) { return w.gzip.Write(data) }

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
