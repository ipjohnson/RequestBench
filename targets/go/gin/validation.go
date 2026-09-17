// Gin's own binding and validation, rather than a hand-written walk over map[string]any.
//
// `binding:` is Gin's tag. It reads it with the go-playground validator it already holds in
// binding.Validator, so the rules are declared on the struct and Gin decides when to run
// them. Nothing here translates what it reports into this repository's vocabulary: the
// field names and the tag names are the library's own, which is the point of #35.
package main

import (
	"encoding/json"
	"errors"
	"reflect"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/validator/v10"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

func init() {
	// Report the field by the name it has on the wire rather than by its Go name, which is
	// what anyone reading the response needs. This is the validator's own hook, not a
	// translation of what it found.
	if v, ok := binding.Validator.Engine().(*validator.Validate); ok {
		v.RegisterTagNameFunc(func(f reflect.StructField) string {
			name := strings.SplitN(f.Tag.Get("json"), ",", 2)[0]
			if name == "-" {
				return ""
			}
			return name
		})
	}
}

// Pointers so `required` means present: a non-pointer int is indistinguishable from an
// absent one, because both arrive as zero.
type lineBody struct {
	ProductID *int `json:"product_id" binding:"required"`
	Qty       *int `json:"qty"        binding:"required,min=1"`
}

// rb:wiring body.*,domain.*
type orderBody struct {
	CustomerID *int       `json:"customer_id" binding:"required"`
	Status     *string    `json:"status"      binding:"required"`
	Lines      []lineBody `json:"lines"       binding:"required,min=1,dive"`
}

// rb:wiring body.*,domain.*
func (o orderBody) order() *d.ValidatedOrder {
	in := make([]d.LineInput, 0, len(o.Lines))
	for _, l := range o.Lines {
		in = append(in, d.LineInput{ProductID: *l.ProductID, Qty: *l.Qty})
	}
	return d.PriceOrder(*o.CustomerID, *o.Status, in)
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

// bindOrder binds and validates, answering the failure itself if there is one.
//
// Two failures and two statuses, because Gin's binder draws the line there and flattening it
// would hide the thing being measured. A body the decoder could not turn into the struct
// never reaches the validator at all, so there is no field to report and it is a 400. A body
// that became the struct and then failed a rule is a 422.
// rb:wiring body.*,domain.*
func bindOrder(c *gin.Context) (*orderBody, bool) {
	var ob orderBody
	if err := c.ShouldBindJSON(&ob); err != nil {
		var invalid validator.ValidationErrors
		if errors.As(err, &invalid) {
			c.JSON(422, gin.H{"error": "validation_failed", "fields": refused(invalid)})
		} else {
			c.JSON(400, gin.H{"error": "invalid_body", "detail": err.Error()})
		}
		return nil, false
	}
	return &ob, true
}

// An unvalidated body, for the endpoints that only parse. The same 400 as above, because it
// is the same decoder failing in the same way.
// rb:wiring body.*,domain.*
func bindAny(c *gin.Context) (map[string]any, bool) {
	var m map[string]any
	if err := json.NewDecoder(c.Request.Body).Decode(&m); err != nil {
		c.JSON(400, gin.H{"error": "invalid_body", "detail": err.Error()})
		return nil, false
	}
	return m, true
}
