package implementation

import (
	"net/http"
	"strconv"
	"sync/atomic"
	"time"
)

// serial counts the runs of every handler that writes x-rb-serial, one counter for the whole
// process. Such a handler writes the Unix time in milliseconds, a bar and the new count, so an
// answer the cache family replays carries the value it was stored with.
var serial atomic.Uint64

// stamp writes the next serial, which says the handler ran.
func stamp(w http.ResponseWriter) {
	w.Header().Set("x-rb-serial", strconv.FormatInt(time.Now().UnixMilli(), 10)+"|"+strconv.FormatUint(serial.Add(1), 10))
}

// fresh answers the payload and writes the next serial.
func fresh(payload *Payload) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		stamp(w)
		respond(w, http.StatusOK, payload)
	}
}
