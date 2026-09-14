package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/url"
	"strconv"

	"github.com/aws/aws-lambda-go/events"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

func itoa(n int) string { return strconv.Itoa(n) }

// lambdaHandler takes an API Gateway v2 event straight into the router. There is no HTTP
// server anywhere in this path, which is what makes it the floor for the lambda-rie host.
func lambdaHandler(_ context.Context, ev events.APIGatewayV2HTTPRequest) (
	resp events.APIGatewayV2HTTPResponse, _ error) {
	defer func() {
		if v := recover(); v != nil {
			msg := "internal"
			if e, isErr := v.(error); isErr {
				msg = e.Error()
			}
			resp = asResponse(jsonRes(500, map[string]string{"error": "internal", "message": msg}))
		}
	}()

	var body map[string]any
	if ev.Body != "" {
		raw := []byte(ev.Body)
		if ev.IsBase64Encoded {
			decoded, err := base64.StdEncoding.DecodeString(ev.Body)
			if err != nil {
				return asResponse(onError(&d.ValidationError{
					Errors: []d.FieldError{{Field: "body", Rule: "json"}}})), nil
			}
			raw = decoded
		}
		if err := json.Unmarshal(raw, &body); err != nil {
			return asResponse(onError(&d.ValidationError{
				Errors: []d.FieldError{{Field: "body", Rule: "json"}}})), nil
		}
	}

	q := url.Values{}
	for k, v := range ev.QueryStringParameters {
		q.Set(k, v)
	}
	return asResponse(Route(ev.RequestContext.HTTP.Method, split(ev.RawPath), q, body)), nil
}

func asResponse(r Result) events.APIGatewayV2HTTPResponse {
	headers := map[string]string{}
	for k, v := range r.Headers {
		headers[k] = v
	}
	var body string
	switch b := r.Body.(type) {
	case nil:
	case string:
		body = b
	default:
		if buf, err := json.Marshal(b); err == nil {
			body = string(buf)
		}
	}
	if r.Status != 204 {
		headers["content-length"] = itoa(len(body))
	}
	return events.APIGatewayV2HTTPResponse{StatusCode: r.Status, Headers: headers, Body: body}
}
