package unittests

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

// postJSON sends a body as the corpus sends a JSON one.
func postJSON(t *testing.T, method, path string, body []byte) *httptest.ResponseRecorder {
	t.Helper()
	return client(t).Do(method, path, bytes.NewReader(body), "Content-Type: application/json")
}

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
func TestTheSchemaNamesEveryRuleOrderInvalidBreaks(t *testing.T) {
	t.Run("body.rejected_all", func(t *testing.T) {
		response := postJSON(t, http.MethodPost, "/body/validate/small", file(t, "order.invalid.json"))

		assertStatus(t, response, http.StatusUnprocessableEntity)
		assertHeader(t, response, "Content-Type", "application/problem+json")
		assertLocations(t, response, "body.customerId", "body.lines", "body.status")
	})
}

// rb:test body.rejected_first
func TestTheFirstErrorRouteStopsAtTheFirstRule(t *testing.T) {
	t.Run("body.rejected_first", func(t *testing.T) {
		response := postJSON(t, http.MethodPost, "/body/validate/first-error", file(t, "order.invalid.json"))

		assertStatus(t, response, http.StatusUnprocessableEntity)
		assertJSON(t, map[string]any{
			"title":  "Unprocessable Entity",
			"status": 422.0,
			"detail": "validation failed",
			"errors": []any{map[string]any{"message": "expected number >= 1", "location": "body.customerId", "value": 0.0}},
		}, response)
	})
}

func TestTheFirstErrorRouteChecksLaterFieldsWhenEarlierOnesPass(t *testing.T) {
	body := []byte(`{"customerId":1,"status":"open","lines":[{"productId":0,"qty":0}]}`)

	response := postJSON(t, http.MethodPost, "/body/validate/first-error", body)

	assertLocations(t, response, "body.lines[0].productId")
}

func TestABadLineIsNamedByItsIndex(t *testing.T) {
	body := []byte(`{"customerId":1,"status":"open","lines":[{"productId":1,"qty":0}]}`)

	response := postJSON(t, http.MethodPost, "/body/validate/small", body)

	assertLocations(t, response, "body.lines[0].qty")
}

func TestAFieldTheSchemaDoesNotNameIsRefused(t *testing.T) {
	body := []byte(`{"customerId":1,"status":"open","lines":[{"productId":1,"qty":1}],"note":"x"}`)

	response := postJSON(t, http.MethodPost, "/body/validate/small", body)

	assertStatus(t, response, http.StatusUnprocessableEntity)
	assertLocations(t, response, "body.note")
}

// assertLocations checks where each error in Huma's problem details says it was, in order.
func assertLocations(t *testing.T, response *httptest.ResponseRecorder, locations ...string) {
	t.Helper()
	problem := parsed(t, response.Body.Bytes()).(map[string]any)
	errs, _ := problem["errors"].([]any)
	got := []string{}
	for _, e := range errs {
		got = append(got, e.(map[string]any)["location"].(string))
	}
	if len(got) != len(locations) {
		t.Fatalf("locations %v, want %v in %s", got, locations, response.Body)
	}
	for i := range got {
		if got[i] != locations[i] {
			t.Fatalf("locations %v, want %v", got, locations)
		}
	}
}
