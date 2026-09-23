package implementation

import (
	"net/http"
	"strconv"
	"sync/atomic"

	"github.com/go-chi/render"
)

// serial is x-rb-serial: one counter for the whole process. A handler that writes it
// increments it and writes the new value, so an answer the cache family replays carries the
// value it was stored with.
var serial atomic.Uint64

// fresh answers the payload and writes the next serial, which says the handler ran.
func fresh(payload *Payload) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("x-rb-serial", strconv.FormatUint(serial.Add(1), 10))
		render.JSON(w, r, payload)
	}
}
