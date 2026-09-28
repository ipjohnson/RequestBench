package implementation

import (
	"strconv"
	"sync/atomic"
	"time"

	"github.com/danielgtaylor/huma/v2"
)

// PayloadOutput answers a payload, which Huma serialises with its JSON format.
type PayloadOutput struct {
	Body *Payload
}

// Echoed is a payload with the values a handler bound written back beside its own fields.
type Echoed[T any] struct {
	*Payload
	Echo T `json:"echo"`
}

// EchoedOutput answers a payload and what the handler bound.
type EchoedOutput[T any] struct {
	Body Echoed[T]
}

// FreshOutput answers a payload with the next serial, which says the handler ran.
type FreshOutput struct {
	Serial string `header:"x-rb-serial"`
	Body   *Payload
}

// humaContext is huma.Context under a name of its own, so a struct can embed it without its field
// hiding the interface's Context method, as Huma embeds it in its own sub-contexts.
type humaContext huma.Context

// serial counts the runs of every handler that writes x-rb-serial, one counter for the whole
// process. Such a handler writes the Unix time in milliseconds, a bar and the new count, so an
// answer the cache family replays carries the value it was stored with.
var serial atomic.Uint64

func nextSerial() string {
	return strconv.FormatInt(time.Now().UnixMilli(), 10) + "|" + strconv.FormatUint(serial.Add(1), 10)
}

func fresh(payload *Payload) *FreshOutput {
	return &FreshOutput{Serial: nextSerial(), Body: payload}
}
