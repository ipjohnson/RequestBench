package implementation

import (
	"errors"
	"net/http"
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v5"
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

// CustomValidator is the adapter Echo's guide registers as e.Validator, which c.Validate calls.
// The guide's adapter wraps the failure in echo.ErrBadRequest, whose message the default error
// handler replaces with "Bad Request". This one puts the validator's text in the message, which
// is the answer the guide prints.
type CustomValidator struct {
	validator *validator.Validate
}

func (cv *CustomValidator) Validate(i any) error {
	if err := cv.validator.Struct(i); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return nil
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
	Fields int   `json:"fields"`
	Bytes  int64 `json:"bytes"`
	Echo   any   `json:"echo"`
}

// bound counts customerId and status, and a productId and a qty per line.
func bound(order any, lines int, request *http.Request) Bound {
	return Bound{Fields: 2 + 2*lines, Bytes: request.ContentLength, Echo: order}
}

// bodyRoutes bind the order with c.Bind on every route, which decodes the body with Echo's
// JSONSerializer. The validate routes then call c.Validate, which runs e.Validator.
func bodyRoutes(e *echo.Echo) {
	// rb:wiring body.*
	e.Validator = &CustomValidator{validator: validate}

	e.POST("/body/bind/small", bind)

	e.POST("/body/bind/medium", bind)

	e.POST("/body/validate/small", validated)

	e.POST("/body/validate/medium", validated)

	e.POST("/body/validate/first-error", validatedToFirstError)
}

func bind(c *echo.Context) error {
	var order Order
	if err := c.Bind(&order); err != nil {
		return err
	}
	return c.JSON(http.StatusOK, bound(&order, len(order.Lines), c.Request()))
}

func validated(c *echo.Context) error {
	var order CheckedOrder
	if err := c.Bind(&order); err != nil {
		return err
	}
	if err := c.Validate(&order); err != nil {
		return err
	}
	return c.JSON(http.StatusOK, bound(&order, len(order.Lines), c.Request()))
}

// validatedToFirstError binds the order without its rules and then checks them itself, because
// go-playground reports every rule a body breaks and has no setting to stop at the first.
func validatedToFirstError(c *echo.Context) error {
	var order Order
	if err := c.Bind(&order); err != nil {
		return err
	}
	if err := firstFailure(order.checked()); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return c.JSON(http.StatusOK, bound(&order, len(order.Lines), c.Request()))
}

func (o Order) checked() *CheckedOrder {
	lines := make([]CheckedLine, len(o.Lines))
	for i, line := range o.Lines {
		lines[i] = CheckedLine(line)
	}
	return &CheckedOrder{CustomerID: o.CustomerID, Status: o.Status, Lines: lines}
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

// firstFailure runs the validator e.Validator holds over one field at a time, the field's own
// items included, and answers the first failure of the first field that has one.
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
