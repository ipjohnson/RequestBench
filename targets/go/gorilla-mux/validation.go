// This target's own validation.
//
// gorilla-mux has no validation layer to plug into, so the handler validates and this file is
// where it lives. It is this target's copy on purpose: sharing one walk across five
// frameworks measured the shared walk rather than the framework, which is the defect #35
// describes. Nothing else imports it.
//
// Because the walk reads the body as a value rather than binding it to a struct, it sees
// every field that is wrong instead of stopping where a decoder would. That is what keeps
// body.rejected_all and body.rejected_first different here: same walk, same order, differing
// only in where it gives up.
package main

import (
	"strconv"

	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

type fieldError struct {
	Field string `json:"field"`
	Rule  string `json:"rule"`
}

// rb:wiring body.*
func invalidBody(errs []fieldError) map[string]any {
	return map[string]any{"error": "validation_failed", "errors": errs}
}

func isInt(v any) bool {
	f, ok := v.(float64)
	return ok && f == float64(int64(f))
}

func reqField(errs *[]fieldError, m map[string]any, field, typ string) {
	v, present := m[field]
	if !present || v == nil {
		*errs = append(*errs, fieldError{field, "required"})
		return
	}
	switch typ {
	case "int":
		if !isInt(v) {
			*errs = append(*errs, fieldError{field, "int"})
		}
	case "string":
		if _, ok := v.(string); !ok {
			*errs = append(*errs, fieldError{field, "string"})
		}
	case "array":
		if _, ok := v.([]any); !ok {
			*errs = append(*errs, fieldError{field, "array"})
		}
	}
}

// validateOrder reports every problem it finds when firstError is false, and stops at the
// first when it is true.
// rb:wiring body.*,domain.*
func validateOrder(m map[string]any, firstError bool) (*d.ValidatedOrder, []fieldError) {
	var errs []fieldError
	bail := func() bool { return firstError && len(errs) > 0 }
	reqField(&errs, m, "customer_id", "int")
	if !bail() {
		reqField(&errs, m, "status", "string")
	}
	if !bail() {
		reqField(&errs, m, "lines", "array")
	}
	raw, isArr := m["lines"].([]any)
	if isArr && !bail() {
		if len(raw) == 0 {
			errs = append(errs, fieldError{"lines", "min_length"})
		}
		for i, e := range raw {
			if bail() {
				break
			}
			l, _ := e.(map[string]any)
			if !isInt(l["product_id"]) {
				errs = append(errs, fieldError{"lines[" + strconv.Itoa(i) + "].product_id", "int"})
			}
			q, ok := l["qty"].(float64)
			if !bail() && (!ok || !isInt(l["qty"]) || q < 1) {
				errs = append(errs, fieldError{"lines[" + strconv.Itoa(i) + "].qty", "min"})
			}
		}
	}
	if len(errs) > 0 {
		return nil, errs
	}
	in := make([]d.LineInput, 0, len(raw))
	for _, e := range raw {
		l := e.(map[string]any)
		in = append(in, d.LineInput{
			ProductID: int(l["product_id"].(float64)),
			Qty:       int(l["qty"].(float64)),
		})
	}
	return d.PriceOrder(int(m["customer_id"].(float64)), m["status"].(string), in), nil
}
