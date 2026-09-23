package implementation

import (
	"errors"
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v3"
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

// rb:wiring body.*
// validate is go-playground's validator. It names a field by its json name, the name the
// client sent, through the hook go-playground offers for that.
var validate = func() *validator.Validate {
	v := validator.New()
	v.RegisterTagNameFunc(func(field reflect.StructField) string {
		name, _, _ := strings.Cut(field.Tag.Get("json"), ",")
		if name == "-" {
			return ""
		}
		return name
	})
	return v
}()

// structValidator is the adapter Fiber's validation guide registers as the app's
// StructValidator. c.Bind() runs it on every struct it binds.
type structValidator struct {
	validate *validator.Validate
}

func (v *structValidator) Validate(out any) error {
	return v.validate.Struct(out)
}

func newValidator() fiber.StructValidator {
	return &structValidator{validate: validate}
}

// CheckedOrder carries the rules orderRequest states as validate tags.
type CheckedOrder struct {
	CustomerID int           `json:"customerId" validate:"gt=0"`
	Status     string        `json:"status" validate:"required"`
	Lines      []CheckedLine `json:"lines" validate:"min=1,dive"`
}

type CheckedLine struct {
	ProductID int `json:"productId" validate:"gt=0"`
	Qty       int `json:"qty" validate:"gt=0"`
}

// rb:end

// Bound is what a bind or validate row answers: the order back, with the leaves the handler
// found in it and the bytes it received.
type Bound struct {
	Fields int `json:"fields"`
	Bytes  int `json:"bytes"`
	Echo   any `json:"echo"`
}

// bound counts customerId and status, and a productId and a qty per line.
func bound(order any, lines int, c fiber.Ctx) Bound {
	return Bound{Fields: 2 + 2*lines, Bytes: len(c.Body()), Echo: order}
}

// bodyRoutes bind the order with c.Bind().Body on every route, which decodes it by its
// Content-Type and then runs the app's StructValidator over it. On the validate routes the type
// carries validate tags.
func bodyRoutes(app *fiber.App) {
	app.Post("/body/bind/small", bind)

	app.Post("/body/bind/medium", bind)

	app.Post("/body/validate/small", validated)

	app.Post("/body/validate/medium", validated)

	app.Post("/body/validate/first-error", validatedToFirstError)
}

func bind(c fiber.Ctx) error {
	var order Order
	if err := c.Bind().Body(&order); err != nil {
		return refuse(c, err)
	}
	return c.JSON(bound(&order, len(order.Lines), c))
}

func validated(c fiber.Ctx) error {
	var order CheckedOrder
	if err := c.Bind().Body(&order); err != nil {
		return refuse(c, err)
	}
	return c.JSON(bound(&order, len(order.Lines), c))
}

// validatedToFirstError binds the order without running the validator, and then checks the
// rules itself, because go-playground reports every rule a body breaks and has no setting to
// stop at the first.
func validatedToFirstError(c fiber.Ctx) error {
	var order CheckedOrder
	if err := c.Bind().SkipValidation(true).Body(&order); err != nil {
		return refuse(c, err)
	}
	if err := firstFailure(&order); err != nil {
		return refuse(c, err)
	}
	return c.JSON(bound(&order, len(order.Lines), c))
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
// and answers the first failure of the first field that has one.
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
