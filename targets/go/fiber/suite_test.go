package main

import (
	"io"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v3"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// rb:test *
// The target, driven through app.Test(), which is Fiber's own and what its documentation
// tests a route with. Fiber is built on fasthttp, which is not an http.Handler, so
// net/http/httptest cannot reach it at all: the four other Go targets share one approach and
// this one cannot use it. app.Test takes a net/http request, runs it through the app over an
// in-memory connection and hands back a net/http response, whose body is the bytes the
// handler wrote.
//
// The app was built inline in main(); router() builds it now and main() serves what it
// returns. TestMain loads the fixture, which main() does, before building it.
var handler *fiber.App

const suiteTarget = "go:fiber"

func TestMain(m *testing.M) {
	readSpec()
	if err := d.Load(filepath.Join(specRoot, "spec", "fixture.json")); err != nil {
		panic(err)
	}
	handler = router()
	os.Exit(m.Run())
}

// sendPlanned sends one of an endpoint's planned requests.
func sendPlanned(a plannedRequest) answer {
	return sendWith(a, a.Headers)
}

func sendWith(a plannedRequest, headers map[string]string) answer {
	body := strings.NewReader("")
	if a.Body != nil {
		body = strings.NewReader(*a.Body)
	}
	req := httptest.NewRequest(a.Method, a.Path, body)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	r, err := handler.Test(req)
	if err != nil {
		panic(err)
	}
	defer r.Body.Close()
	raw, _ := io.ReadAll(r.Body)
	return answer{r.StatusCode, r.Header.Get("Content-Type"), r.Header.Get("Content-Encoding"),
		raw, r.Header}
}

// sendAfterCapture asks for the validator first, then sends the request that carries it.
func sendAfterCapture(a plannedRequest) answer {
	method, path, header := captureFor(a)
	r, err := handler.Test(httptest.NewRequest(method, path, nil))
	if err != nil {
		panic(err)
	}
	r.Body.Close()
	return sendWith(a, withCapture(a, r.Header.Get(header)))
}

// rb:end
