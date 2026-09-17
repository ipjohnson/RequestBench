// Fiber's own binding and validation.
//
// Fiber takes a StructValidator in its config and runs it as part of `c.Bind().Body()`, so
// binding and validating are one call the framework owns and no handler invokes a validator.
// The rules are declared on the struct in the `validate:` tag go-playground reads.
package main

import (
	"encoding/json"
	"errors"
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v3"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// What goes in fiber.Config{StructValidator}. Fiber asks for exactly this one method.
type structValidator struct{ v *validator.Validate }

func (s *structValidator) Validate(out any) error { return s.v.Struct(out) }

func newValidator() fiber.StructValidator {
	v := validator.New(validator.WithRequiredStructEnabled())
	v.RegisterTagNameFunc(jsonName)
	return &structValidator{v}
}

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

// Pointers so `required` means present: a non-pointer int is indistinguishable from an
// absent one, because both arrive as zero.
type lineBody struct {
	ProductID *int `json:"product_id" validate:"required"`
	Qty       *int `json:"qty"        validate:"required,min=1"`
}

type orderBody struct {
	CustomerID *int       `json:"customer_id" validate:"required"`
	Status     *string    `json:"status"      validate:"required"`
	Lines      []lineBody `json:"lines"       validate:"required,min=1,dive"`
}

func (o orderBody) order() *d.ValidatedOrder {
	in := make([]d.LineInput, 0, len(o.Lines))
	for _, l := range o.Lines {
		in = append(in, d.LineInput{ProductID: *l.ProductID, Qty: *l.Qty})
	}
	return d.PriceOrder(*o.CustomerID, *o.Status, in)
}

// bindOrder runs Fiber's bind-and-validate, answering the failure itself.
//
// One call, but two failures underneath it, and they are kept apart because Fiber's own
// layers are distinct: a body the decoder could not turn into the struct never reaches the
// StructValidator, so there is no field to report and it is a 400. A body that became the
// struct and then failed a rule is a 422.
func bindOrder(c fiber.Ctx) (*orderBody, bool) {
	var ob orderBody
	if err := c.Bind().Body(&ob); err != nil {
		var invalid validator.ValidationErrors
		if errors.As(err, &invalid) {
			_ = c.Status(422).JSON(fiber.Map{
				"error": "validation_failed", "fields": refused(invalid),
			})
		} else {
			_ = c.Status(400).JSON(fiber.Map{"error": "invalid_body", "detail": err.Error()})
		}
		return nil, false
	}
	return &ob, true
}

// An unvalidated body, for the endpoints that only parse.
func bindAny(c fiber.Ctx) (map[string]any, bool) {
	var m map[string]any
	if err := json.Unmarshal(c.Body(), &m); err != nil {
		_ = c.Status(400).JSON(fiber.Map{"error": "invalid_body", "detail": err.Error()})
		return nil, false
	}
	return m, true
}
