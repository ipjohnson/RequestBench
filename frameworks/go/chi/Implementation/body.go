package implementation

import (
	"errors"
	"net/http"
	"reflect"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
	"github.com/go-playground/validator/v10"
)

// Order is the body the bind rows send, bound with its types and none of its rules.
type Order struct {
	CustomerID int    `json:"customerId"`
	Status     string `json:"status"`
	Lines      []Line `json:"lines"`
}

type Line struct {
	ProductID int `json:"productId"`
	Qty       int `json:"qty"`
}

// Bind is render's hook after the body is decoded. The bind rows check nothing there.
func (o *Order) Bind(*http.Request) error { return nil }

// rb:wiring body.*
// validate is go-playground's validator. It names a field by its json name, the name the
// client sent, through the hook go-playground offers for that.
var validate = func() *validator.Validate {
	v := validator.New(validator.WithRequiredStructEnabled())
	v.RegisterTagNameFunc(func(field reflect.StructField) string {
		name, _, _ := strings.Cut(field.Tag.Get("json"), ",")
		if name == "-" {
			return ""
		}
		return name
	})
	return v
}()

// CheckedOrder carries the rules orderRequest states as validate tags. Its Bind runs the
// validator once render has decoded the body.
type CheckedOrder struct {
	CustomerID int           `json:"customerId" validate:"gt=0"`
	Status     string        `json:"status" validate:"required"`
	Lines      []CheckedLine `json:"lines" validate:"min=1,dive"`
}

type CheckedLine struct {
	ProductID int `json:"productId" validate:"gt=0"`
	Qty       int `json:"qty" validate:"gt=0"`
}

func (o *CheckedOrder) Bind(*http.Request) error { return validate.Struct(o) }

// FirstErrorOrder is CheckedOrder with a Bind that stops at the first rule broken.
type FirstErrorOrder CheckedOrder

func (o *FirstErrorOrder) Bind(*http.Request) error { return firstFailure((*CheckedOrder)(o)) }

// rb:end

// Bound is what a bind or validate row answers: the order back, with the leaves the handler
// found in it and the bytes it received.
type Bound struct {
	Fields int   `json:"fields"`
	Bytes  int64 `json:"bytes"`
	Echo   any   `json:"echo"`
}

// bound counts customerId and status, and a productId and a qty per line.
func bound(order any, lines int, request *http.Request) Bound {
	return Bound{Fields: 2 + 2*lines, Bytes: request.ContentLength, Echo: order}
}

// bodyRoutes bind the order with render.Bind on every route, which decodes the body by its
// Content-Type and then calls the order's Bind. On the validate routes that is the validator.
func bodyRoutes(r chi.Router) {
	r.Post("/body/bind/small", bind)

	r.Post("/body/bind/medium", bind)

	r.Post("/body/validate/small", validated)

	r.Post("/body/validate/medium", validated)

	r.Post("/body/validate/first-error", validatedToFirstError)
}

func bind(w http.ResponseWriter, r *http.Request) {
	var order Order
	if err := render.Bind(r, &order); err != nil {
		refuse(w, r, err)
		return
	}
	render.JSON(w, r, bound(&order, len(order.Lines), r))
}

func validated(w http.ResponseWriter, r *http.Request) {
	var order CheckedOrder
	if err := render.Bind(r, &order); err != nil {
		refuse(w, r, err)
		return
	}
	render.JSON(w, r, bound(&order, len(order.Lines), r))
}

func validatedToFirstError(w http.ResponseWriter, r *http.Request) {
	var order FirstErrorOrder
	if err := render.Bind(r, &order); err != nil {
		refuse(w, r, err)
		return
	}
	render.JSON(w, r, bound(&order, len(order.Lines), r))
}

// rb:wiring body.*
// checkedFields are CheckedOrder's fields in the order they are declared, as the validator
// names them in a namespace.
var checkedFields = func() []string {
	t := reflect.TypeFor[CheckedOrder]()
	names := make([]string, t.NumField())
	for i := range names {
		names[i] = t.Name() + "." + t.Field(i).Name
	}
	return names
}()

// firstFailure runs the validator over one field at a time, the field's own items included,
// and answers the first failure of the first field that has one. go-playground reports every
// rule a body breaks and has no setting to stop at the first.
func firstFailure(order *CheckedOrder) error {
	for _, field := range checkedFields {
		err := validate.StructFiltered(order, func(namespace []byte) bool { return !within(string(namespace), field) })
		var failed validator.ValidationErrors
		if errors.As(err, &failed) {
			return failed[:1]
		}
		if err != nil {
			return err
		}
	}
	return nil
}

// within says whether a validator namespace is the field or something inside it.
func within(namespace, field string) bool {
	rest, ok := strings.CutPrefix(namespace, field)
	return ok && (rest == "" || rest[0] == '.' || rest[0] == '[')
}

// rb:end
