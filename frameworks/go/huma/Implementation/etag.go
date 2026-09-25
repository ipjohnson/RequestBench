package implementation

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/conditional"
)

// TaggedInput carries the conditional headers, which Huma's conditional package reads.
type TaggedInput struct {
	conditional.Params
}

// TaggedOutput answers the encoded payload with its validator.
type TaggedOutput struct {
	ETag        string `header:"ETag"`
	ContentType string `header:"Content-Type"`
	Serial      string `header:"x-rb-serial"`
	Body        []byte
}

// etagRoutes answer the payload with a validator. Huma computes no ETag, so the handler encodes the
// payload and hashes the bytes it will send, and the conditional package compares the hash with
// If-None-Match. The body is built and hashed before anything is compared, so a 304 saves the
// write and nothing else.
func etagRoutes(api huma.API, p *Payloads) {
	huma.Get(api, "/etag/small", tagged(&p.Small))

	huma.Get(api, "/etag/large", tagged(&p.Large))
}

// rb:wiring etag.*
func tagged(payload *Payload) func(context.Context, *TaggedInput) (*TaggedOutput, error) {
	return func(ctx context.Context, in *TaggedInput) (*TaggedOutput, error) {
		body, err := json.Marshal(payload)
		if err != nil {
			return nil, huma.Error500InternalServerError("the payload does not encode", err)
		}
		sum := sha1.Sum(body)
		hash := hex.EncodeToString(sum[:])
		etag := `"` + hash + `"`
		if in.HasConditionalParams() {
			// The conditional package compares the tag without its quotes, and answers 304 when it matches.
			if err := in.PreconditionFailed(hash, time.Time{}); err != nil {
				return nil, huma.ErrorWithHeaders(err, http.Header{"ETag": {etag}})
			}
		}
		return &TaggedOutput{ETag: etag, ContentType: "application/json", Serial: nextSerial(), Body: body}, nil
	}
}

// rb:end
