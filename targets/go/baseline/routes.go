package main

import (
	"errors"
	"strconv"

	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// Result is a response before it has a transport. Routing returns one of these rather
// than writing to a socket, so the same routing serves an http.Handler and a Lambda event
// handler without either wrapping the other.
type Result struct {
	Status  int
	Headers map[string]string
	Body    any
}

const (
	ctJSON = "application/json"
	ctText = "text/plain"
)

func jsonRes(status int, v any) Result {
	return Result{Status: status, Headers: map[string]string{"content-type": ctJSON}, Body: v}
}
func textRes(status int, s string) Result {
	return Result{Status: status, Headers: map[string]string{"content-type": ctText}, Body: s}
}
func located(status int, v any, loc string) Result {
	return Result{Status: status, Body: v,
		Headers: map[string]string{"content-type": ctJSON, "location": loc}}
}

var notFound = jsonRes(404, map[string]string{"error": "not_found"})

func send(v any, err error) Result {
	if err != nil {
		return onError(err)
	}
	return jsonRes(200, v)
}

func onError(err error) Result {
	var ve *d.ValidationError
	switch {
	case errors.Is(err, d.ErrNotFound):
		return notFound
	case errors.As(err, &ve):
		return jsonRes(422, map[string]any{"error": "validation_failed", "errors": ve.Errors})
	default:
		return jsonRes(500, map[string]string{"error": "internal", "message": err.Error()})
	}
}

// Route dispatches on method and path segments. Panics on /boom, which every transport
// recovers into the same 500 the contract asks for.
func Route(method string, seg []string, q map[string][]string, body map[string]any) Result {
	n := len(seg)
	switch method {
	case "GET":
		switch n {
		case 1:
			switch seg[0] {
			case "plaintext":
				return textRes(200, "Hello, World!")
			case "health":
				return textRes(200, "ok")
			case "__meta":
				return jsonRes(200, meta())
			case "products":
				return jsonRes(200, d.ListProducts(q))
			case "customers":
				return jsonRes(200, d.ListCustomers(q))
			case "orders":
				return jsonRes(200, d.ListOrders(q))
			case "search":
				return jsonRes(200, d.Search(q))
			case "dashboard":
				return jsonRes(200, d.Dashboard())
			case "boom":
				panic(d.Boom{})
			case "forbidden":
				return jsonRes(403, map[string]string{"error": "forbidden"})
			}
		case 2:
			switch {
			case seg[0] == "json" && seg[1] == "small":
				return jsonRes(200, d.JSONSmall())
			case seg[0] == "products":
				return send(d.GetProduct(seg[1]))
			case seg[0] == "customers":
				return send(d.GetCustomer(seg[1]))
			case seg[0] == "orders":
				return send(d.GetOrder(seg[1]))
			}
		case 3:
			switch {
			case seg[0] == "products" && seg[2] == "reviews":
				return send(d.GetProductReviews(seg[1]))
			case seg[0] == "products" && seg[2] == "related":
				return send(d.RelatedProducts(seg[1]))
			case seg[0] == "customers" && seg[2] == "orders":
				return send(d.GetCustomerOrders(seg[1]))
			case seg[0] == "customers" && seg[2] == "summary":
				return send(d.CustomerSummary(seg[1]))
			case seg[0] == "orders" && seg[2] == "lines":
				return send(d.GetOrderLines(seg[1]))
			case seg[0] == "orders" && seg[2] == "full":
				return send(d.OrderFull(seg[1]))
			case seg[0] == "regions" && seg[2] == "customers":
				return send(d.GetRegionCustomers(seg[1]))
			case seg[0] == "regions" && seg[2] == "report":
				return send(d.RegionReport(seg[1]))
			}
		case 4:
			switch {
			case seg[0] == "customers" && seg[2] == "orders":
				return send(d.GetCustomerOrder(seg[1], seg[3]))
			case seg[0] == "orders" && seg[2] == "lines":
				return send(d.GetOrderLine(seg[1], seg[3]))
			}
		case 8:
			if seg[0] == "regions" && seg[2] == "customers" && seg[4] == "orders" && seg[6] == "lines" {
				return send(d.GetOrderLine(seg[5], seg[7]))
			}
		}
	case "POST":
		switch n {
		case 1:
			switch seg[0] {
			case "echo":
				return jsonRes(200, d.Echo(body))
			case "orders":
				v, err := d.ValidateOrder(body)
				if err != nil {
					return onError(err)
				}
				return located(201, v, "/orders/"+strconv.Itoa(d.NextOrderID))
			}
		case 2:
			if seg[1] == "validate" {
				switch seg[0] {
				case "orders":
					return send(d.ValidateOrder(body))
				case "customers":
					return send(d.ValidateCustomer(body))
				case "products":
					return send(d.ValidateProduct(body))
				}
			}
		case 3:
			if seg[0] == "orders" && seg[2] == "lines" {
				o, err := d.GetOrder(seg[1])
				if err != nil {
					return onError(err)
				}
				v, err := d.ValidateLine(body)
				if err != nil {
					return onError(err)
				}
				return located(201, v, "/orders/"+seg[1]+"/lines/"+strconv.Itoa(len(o.Lines)+1))
			}
		}
	case "PUT":
		if n == 2 && seg[0] == "orders" {
			o, err := d.GetOrder(seg[1])
			if err != nil {
				return onError(err)
			}
			v, err := d.ValidateOrder(body)
			if err != nil {
				return onError(err)
			}
			return jsonRes(200, d.ValidatedOrderWithID{ID: o.ID, ValidatedOrder: *v})
		}
	case "PATCH":
		if n == 2 && seg[0] == "customers" {
			return send(d.PatchCustomer(seg[1], body))
		}
	case "DELETE":
		if n == 4 && seg[0] == "orders" && seg[2] == "lines" {
			if _, err := d.GetOrderLine(seg[1], seg[3]); err != nil {
				return onError(err)
			}
			return Result{Status: 204, Headers: map[string]string{}}
		}
	}
	return notFound
}
