package unittests

import (
	"net/http"
	"strings"
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
func TestTheValidatorNamesEveryRuleOrderInvalidBreaks(t *testing.T) {
	t.Run("body.rejected_all", func(t *testing.T) {
		response := postJSON(t, http.MethodPost, "/body/validate/small", file(t, "order.invalid.json"))

		assertStatus(t, response, http.StatusBadRequest)
		assertJSON(t, refusal("customerId", "gt", "status", "required", "lines", "min"), response)
	})
}

// rb:test body.rejected_first
func TestTheFirstErrorRouteStopsAtTheFirstRule(t *testing.T) {
	t.Run("body.rejected_first", func(t *testing.T) {
		response := postJSON(t, http.MethodPost, "/body/validate/first-error", file(t, "order.invalid.json"))

		assertStatus(t, response, http.StatusBadRequest)
		assertJSON(t, refusal("customerId", "gt"), response)
	})
}

func TestTheFirstErrorRouteChecksLaterFieldsWhenEarlierOnesPass(t *testing.T) {
	body := []byte(`{"customerId":1,"status":"open","lines":[{"productId":0,"qty":0}]}`)

	response := postJSON(t, http.MethodPost, "/body/validate/first-error", body)

	assertJSON(t, refusal("productId", "gt"), response)
}

// The guide's answer names a field by e.Field(), its own name without the path to it.
func TestABadLineIsNamedWithoutItsIndex(t *testing.T) {
	body := []byte(`{"customerId":1,"status":"open","lines":[{"productId":1,"qty":0}]}`)

	response := postJSON(t, http.MethodPost, "/body/validate/small", body)

	assertJSON(t, refusal("qty", "gt"), response)
}

// A decode failure is a *fiber.BindError, which carries no status, so the default error handler
// answers it with 500.
func TestAValueOfTheWrongTypeReachesTheErrorHandlerAs500(t *testing.T) {
	for _, path := range []string{"/body/bind/small", "/body/validate/small", "/body/validate/first-error"} {
		response := postJSON(t, http.MethodPost, path, []byte(`{"customerId":"not-an-int","status":42,"lines":"nope"}`))

		assertStatus(t, response, http.StatusInternalServerError)
		if body := string(bodyOf(t, response)); !strings.HasPrefix(body, "bind ") {
			t.Fatalf("body %q", body)
		}
	}
}

// refusal is the answer step 4 of Fiber's validation guide writes, from field and rule pairs.
func refusal(pairs ...string) any {
	entries := []any{}
	for i := 0; i+1 < len(pairs); i += 2 {
		entries = append(entries, map[string]any{"field": pairs[i], "rule": pairs[i+1]})
	}
	return map[string]any{"errors": entries}
}
