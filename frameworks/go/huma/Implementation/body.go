package implementation

import (
	"context"
	"encoding/json"
	"reflect"
	"strings"

	"github.com/danielgtaylor/huma/v2"
)

// Order is the body the bind rows send, with its types and none of its rules.
type Order struct {
	CustomerID int    `json:"customerId"`
	Status     string `json:"status"`
	Lines      []Line `json:"lines"`
}

type Line struct {
	ProductID int `json:"productId"`
	Qty       int `json:"qty"`
}

// rb:wiring body.*
// CheckedOrder carries orderRequest's rules as Huma's validation tags, which become its JSON
// Schema.
type CheckedOrder struct {
	CustomerID int           `json:"customerId" minimum:"1"`
	Status     string        `json:"status" minLength:"1"`
	Lines      []CheckedLine `json:"lines" minItems:"1"`
}

type CheckedLine struct {
	ProductID int `json:"productId" minimum:"1"`
	Qty       int `json:"qty" minimum:"1"`
}

// rb:end

// Bound is what a bind or validate row answers: the order back, with the leaves the handler found
// in it and the bytes it received.
type Bound[T any] struct {
	Fields int   `json:"fields"`
	Bytes  int64 `json:"bytes"`
	Echo   T     `json:"echo"`
}

type BoundOutput[T any] struct {
	Body Bound[T]
}

// OrderInput is the order, parsed into Body, and the bytes it came in, which the answer counts.
type OrderInput[T any] struct {
	RawBody []byte
	Body    T
}

func bound[T any](in *OrderInput[T], lines int) *BoundOutput[T] {
	// customerId and status, and a productId and a qty per line.
	return &BoundOutput[T]{Body: Bound[T]{Fields: 2 + 2*lines, Bytes: int64(len(in.RawBody)), Echo: in.Body}}
}

// bodyRoutes take the order as the input's Body. The bind routes skip Huma's validation of the
// body, so Huma only parses it. The validate routes check it against CheckedOrder's schema, and
// the first-error route checks the same schema one field at a time in a resolver.
func bodyRoutes(api huma.API) {
	parseOnly := func(o *huma.Operation) { o.SkipValidateBody = true }

	huma.Post(api, "/body/bind/small", bind, parseOnly)

	huma.Post(api, "/body/bind/medium", bind, parseOnly)

	huma.Post(api, "/body/validate/small", validated)

	huma.Post(api, "/body/validate/medium", validated)

	huma.Post(api, "/body/validate/first-error", validatedToFirstError)
}

func bind(ctx context.Context, in *OrderInput[Order]) (*BoundOutput[Order], error) {
	return bound(in, len(in.Body.Lines)), nil
}

func validated(ctx context.Context, in *OrderInput[CheckedOrder]) (*BoundOutput[CheckedOrder], error) {
	return bound(in, len(in.Body.Lines)), nil
}

func validatedToFirstError(ctx context.Context, in *FirstErrorInput) (*BoundOutput[Order], error) {
	return bound(&in.OrderInput, len(in.Body.Lines)), nil
}

// rb:wiring body.*
// FirstErrorInput is the order with its types alone, which Huma checks, and a resolver that checks
// its raw bytes against CheckedOrder's schema one field at a time. Huma reports every rule a body
// breaks and has no setting to stop at the first.
type FirstErrorInput struct {
	OrderInput[Order]
}

// rules holds CheckedOrder's schema, and the schemas it refers to, for the first-error route.
var rules = huma.NewMapRegistry("#/components/schemas/", huma.DefaultSchemaNamer)

var checked = rules.Schema(reflect.TypeFor[CheckedOrder](), false, "")

// checkedFields are CheckedOrder's fields by their JSON names, in the order they are declared.
var checkedFields = func() []string {
	t := reflect.TypeFor[CheckedOrder]()
	names := make([]string, t.NumField())
	for i := range names {
		names[i], _, _ = strings.Cut(t.Field(i).Tag.Get("json"), ",")
	}
	return names
}()

// Resolve runs Huma's validator over one field of the body at a time, and answers the first
// failure of the first field that has one.
func (in *FirstErrorInput) Resolve(ctx huma.Context) []error {
	var body map[string]any
	if json.Unmarshal(in.RawBody, &body) != nil {
		// Huma has refused a body that does not parse.
		return nil
	}
	path := huma.NewPathBuffer(make([]byte, 0, 32), 0)
	res := &huma.ValidateResult{}
	for _, name := range checkedFields {
		path.Reset()
		path.Push("body")
		path.Push(name)
		huma.Validate(rules, checked.Properties[name], path, huma.ModeWriteToServer, body[name], res)
		if len(res.Errors) > 0 {
			return res.Errors[:1]
		}
	}
	return nil
}

// rb:end
