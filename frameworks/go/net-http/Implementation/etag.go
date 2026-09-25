package implementation

import (
	"bytes"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"time"
)

// etagRoutes answer the payload with a validator. net/http computes no ETag, not even for a file,
// so the handler hashes the body itself. ServeContent answers If-None-Match against a tag the
// handler has set, so it does the comparing. The body is built and hashed before anything is
// compared, so a 304 saves the write and nothing else.
func etagRoutes(mux *http.ServeMux, p *Payloads) {
	mux.Handle("GET /etag/small", tagged(&p.Small))

	mux.Handle("GET /etag/large", tagged(&p.Large))
}

// rb:wiring etag.*
// tagged encodes the payload into a buffer, writes the buffer's SHA-1 as the ETag, and hands the
// buffer to ServeContent, which answers 304 when If-None-Match names the tag.
func tagged(payload *Payload) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		stamp(w)
		var body bytes.Buffer
		_ = json.NewEncoder(&body).Encode(payload)
		sum := sha1.Sum(body.Bytes())
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("ETag", `"`+hex.EncodeToString(sum[:])+`"`)
		// With no modification time, ServeContent writes no Last-Modified and compares the tag alone.
		http.ServeContent(w, r, "", time.Time{}, bytes.NewReader(body.Bytes()))
	}
}

// rb:end
