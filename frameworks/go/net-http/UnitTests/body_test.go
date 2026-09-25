package unittests

import (
	"net/http"
	"regexp"
	"testing"
)

// rb:test body.bind_small,body.bind_medium,body.validate_small,body.validate_medium
func TestAnOrderIsAnsweredWithItsLeavesItsLengthAndItself(t *testing.T) {
	for _, row := range []struct{ id, path, file string }{
		{"body.bind_small", "/body/bind/small", "order.small.json"},
		{"body.bind_medium", "/body/bind/medium", "order.medium.json"},
		{"body.validate_small", "/body/validate/small", "order.small.json"},
		{"body.validate_medium", "/body/validate/medium", "order.medium.json"},
	} {
		t.Run(row.id, func(t *testing.T) {
			body := file(t, row.file)
			order := parsed(t, body).(map[string]any)

			response := postJSON(t, http.MethodPost, row.path, body)

			want := map[string]any{
				"fields": float64(2 + 2*len(order["lines"].([]any))),
				"bytes":  float64(len(body)),
				"echo":   order,
			}
			assertOK(t, want, response)
		})
	}
}

// rb:test body.rejected_all
func TestTheCheckNamesEveryRuleOrderInvalidBreaks(t *testing.T) {
	t.Run("body.rejected_all", func(t *testing.T) {
		response := postJSON(t, http.MethodPost, "/body/validate/small", file(t, "order.invalid.json"))

		assertStatus(t, response, http.StatusBadRequest)
		assertJSON(t, map[string]any{"error": "customerId: must be greater than 0\nstatus: must not be empty\nlines: must not be empty"}, response)
	})
}

// rb:test body.rejected_first
func TestTheFirstErrorRouteStopsAtTheFirstRule(t *testing.T) {
	t.Run("body.rejected_first", func(t *testing.T) {
		response := postJSON(t, http.MethodPost, "/body/validate/first-error", file(t, "order.invalid.json"))

		assertStatus(t, response, http.StatusBadRequest)
		assertJSON(t, map[string]any{"error": "customerId: must be greater than 0"}, response)
	})
}

func TestTheFirstErrorRouteChecksLaterFieldsWhenEarlierOnesPass(t *testing.T) {
	body := []byte(`{"customerId":1,"status":"open","lines":[{"productId":0,"qty":0}]}`)

	response := postJSON(t, http.MethodPost, "/body/validate/first-error", body)

	assertNamed(t, response, "lines[0].productId")
}

func TestABadLineIsNamedByItsIndex(t *testing.T) {
	body := []byte(`{"customerId":1,"status":"open","lines":[{"productId":1,"qty":0}]}`)

	response := postJSON(t, http.MethodPost, "/body/validate/small", body)

	assertNamed(t, response, "lines[0].qty")
}

func TestAValueOfTheWrongTypeIsRefusedByTheDecoderAndNamesNoRule(t *testing.T) {
	for _, path := range []string{"/body/bind/small", "/body/validate/small", "/body/validate/first-error"} {
		response := postJSON(t, http.MethodPost, path, []byte(`{"customerId":"not-an-int","status":42,"lines":"nope"}`))

		assertStatus(t, response, http.StatusBadRequest)
		assertNamed(t, response)
	}
}

var rule = regexp.MustCompile(`(?m)^([\w.\[\]]+): must `)

// assertNamed checks the fields the refusal's lines name, in the order it names them.
func assertNamed(t *testing.T, response *http.Response, fields ...string) {
	t.Helper()
	refusal := parsed(t, bodyOf(t, response)).(map[string]any)
	named := []string{}
	for _, m := range rule.FindAllStringSubmatch(refusal["error"].(string), -1) {
		named = append(named, m[1])
	}
	if len(named) != len(fields) {
		t.Fatalf("named %v, want %v in %q", named, fields, refusal["error"])
	}
	for i := range named {
		if named[i] != fields[i] {
			t.Fatalf("named %v, want %v", named, fields)
		}
	}
}
