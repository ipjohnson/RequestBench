// json: the serializer and response buffering across three size regimes.
//
// Three static routes, not /json/:size. The size set is fixed, so a capture would make the
// router pay parameter cost on the family every other target serves from a static route,
// and it would answer 200 with an empty body for a size that does not exist.
package main

import (
	"bytes"
	"sync"

	"github.com/bytedance/sonic"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
	"github.com/labstack/echo/v5"
)

// The JSONSerializer the engine holds: DefaultJSONSerializer's two methods over
// sonic.ConfigStd, the sonic configuration that writes what encoding/json writes. Echo
// documents the slot and points at DefaultJSONSerializer as the shape to follow, and in v5
// that shape reads the request body into a pooled buffer before decoding it.
// rb:wiring json.*,body.*
type sonicSerializer struct{}

func (sonicSerializer) Serialize(c *echo.Context, target any, indent string) error {
	enc := sonic.ConfigStd.NewEncoder(c.Response())
	if indent != "" {
		enc.SetIndent("", indent)
	}
	return enc.Encode(target)
}

// bodies and maxPooledBody are DefaultJSONSerializer's buffer pool and the cap on what it
// takes back. sonic.ConfigStd copies every string it decodes, so the buffer is free to reuse.
var bodies = sync.Pool{New: func() any { return new(bytes.Buffer) }}

const maxPooledBody = 1 << 16

func (sonicSerializer) Deserialize(c *echo.Context, target any) error {
	buf := bodies.Get().(*bytes.Buffer)
	buf.Reset()
	defer func() {
		if buf.Cap() <= maxPooledBody {
			bodies.Put(buf)
		}
	}()
	if _, err := buf.ReadFrom(c.Request().Body); err != nil {
		return echo.ErrBadRequest.Wrap(err)
	}
	if err := sonic.ConfigStd.Unmarshal(buf.Bytes(), target); err != nil {
		return echo.ErrBadRequest.Wrap(err)
	}
	return nil
}

// The response is read once and served from the closure rather than looked up per request:
// the map lookup is not what any of these endpoints is measuring.
// rb:wiring json.*,parameters.*,headers.*,middleware.*,authorized.*
func payload(size string) echo.HandlerFunc {
	body := d.Payload(size)
	return func(c *echo.Context) error { return c.JSON(200, body) }
}

func registerJSON(e *echo.Echo) {
	e.GET("/json/small", payload("small"))

	e.GET("/json/medium", payload("medium"))

	e.GET("/json/large", payload("large"))
}
