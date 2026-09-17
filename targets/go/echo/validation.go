// Echo's own binding and validation.
//
// Echo has no validator of its own; it has a slot for one. `e.Validator` takes anything
// implementing echo.Validator, and `c.Validate` is what invokes it, so the framework decides
// when validation runs and the handler never calls a validator directly. The rules are
// declared on the struct in the `validate:` tag go-playground reads.
package main

import (
	"encoding/json"
	"errors"
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
	"github.com/labstack/echo/v4"
)

// Report the field by the name it has on the wire rather than by its Go name. The
// validator's own hook, not a translation of what it found.
func jsonName(f reflect.StructField) string {
	name := strings.SplitN(f.Tag.Get("json"), ",", 2)[0]
	if name == "-" {
		return ""
	}
	return name
}

// What the validator refused, in its own words: the field as it is named on the wire, and
// the tag that rejected it.
func refused(errs validator.ValidationErrors) map[string]string {
	out := make(map[string]string, len(errs))
	for _, e := range errs {
		out[e.Field()] = e.Tag()
	}
	return out
}

// What goes in e.Validator. Echo asks for exactly this one method.
type structValidator struct{ v *validator.Validate }

func (s *structValidator) Validate(i any) error { return s.v.Struct(i) }

// rb:wiring body.*
func newValidator() echo.Validator {
	v := validator.New(validator.WithRequiredStructEnabled())
	v.RegisterTagNameFunc(jsonName)
	return &structValidator{v}
}

// Pointers so `required` means present: a non-pointer int is indistinguishable from an
// absent one, because both arrive as zero.
type lineBody struct {
	ProductID *int `json:"product_id" validate:"required"`
	Qty       *int `json:"qty"        validate:"required,min=1"`
}

// rb:wiring body.*,domain.*
type orderBody struct {
	CustomerID *int       `json:"customer_id" validate:"required"`
	Status     *string    `json:"status"      validate:"required"`
	Lines      []lineBody `json:"lines"       validate:"required,min=1,dive"`
}

// rb:wiring body.*,domain.*
func (o orderBody) order() *d.ValidatedOrder {
	in := make([]d.LineInput, 0, len(o.Lines))
	for _, l := range o.Lines {
		in = append(in, d.LineInput{ProductID: *l.ProductID, Qty: *l.Qty})
	}
	return d.PriceOrder(*o.CustomerID, *o.Status, in)
}

// rb:wiring body.*,domain.*
// bindOrder runs Echo's binder and then Echo's validator, answering the failure itself.
//
// Two failures and two statuses, because Echo draws the line there: Bind answers an
// HTTPError with 400 for a body it could not read, and a body that became the struct and
// then failed a rule never went near the binder.
func bindOrder(c echo.Context) (*orderBody, bool) {
	var ob orderBody
	if err := c.Bind(&ob); err != nil {
		_ = c.JSON(400, map[string]any{"error": "invalid_body", "detail": detailOf(err)})
		return nil, false
	}
	if err := c.Validate(&ob); err != nil {
		var invalid validator.ValidationErrors
		if !errors.As(err, &invalid) {
			// The validator itself failed rather than the body. One envelope per status, so
			// this does not get dressed up as a validation failure.
			_ = c.JSON(500, map[string]string{"error": "internal", "message": err.Error()})
			return nil, false
		}
		_ = c.JSON(422, map[string]any{
			"error": "validation_failed", "fields": refused(invalid),
		})
		return nil, false
	}
	return &ob, true
}

// An unvalidated body, for the endpoints that only parse.
func bindAny(c echo.Context) (map[string]any, bool) {
	var m map[string]any
	if err := json.NewDecoder(c.Request().Body).Decode(&m); err != nil {
		_ = c.JSON(400, map[string]any{"error": "invalid_body", "detail": err.Error()})
		return nil, false
	}
	return m, true
}

// Echo wraps a bind failure in its own HTTPError; the message underneath is what the decoder
// actually said, and that is what is worth reporting.
func detailOf(err error) string {
	var he *echo.HTTPError
	if errors.As(err, &he) {
		if he.Internal != nil {
			return he.Internal.Error()
		}
		if s, ok := he.Message.(string); ok {
			return s
		}
	}
	return err.Error()
}
