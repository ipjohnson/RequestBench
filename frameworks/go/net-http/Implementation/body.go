package implementation

import (
	"encoding/json"
	"errors"
	"fmt"
	"iter"
	"net/http"
	"slices"
)

// Order is the body the bind and validate rows send.
type Order struct {
	CustomerID int    `json:"customerId"`
	Status     string `json:"status"`
	Lines      []Line `json:"lines"`
}

type Line struct {
	ProductID int `json:"productId"`
	Qty       int `json:"qty"`
}

// Bound is what a bind or validate row answers: the order back, with the leaves the handler
// found in it and the bytes it received.
type Bound struct {
	Fields int    `json:"fields"`
	Bytes  int64  `json:"bytes"`
	Echo   *Order `json:"echo"`
}

// bound counts customerId and status, and a productId and a qty per line.
func bound(order *Order, r *http.Request) Bound {
	return Bound{Fields: 2 + 2*len(order.Lines), Bytes: r.ContentLength, Echo: order}
}

// bodyRoutes decode the order with encoding/json on every route. The standard library has no
// validator, so the validate routes check the order's rules themselves.
func bodyRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /body/bind/small", bind)

	mux.HandleFunc("POST /body/bind/medium", bind)

	mux.HandleFunc("POST /body/validate/small", validated)

	mux.HandleFunc("POST /body/validate/medium", validated)

	mux.HandleFunc("POST /body/validate/first-error", validatedToFirstError)
}

func bind(w http.ResponseWriter, r *http.Request) {
	var order Order
	if err := json.NewDecoder(r.Body).Decode(&order); err != nil {
		refuse(w, err)
		return
	}
	respond(w, http.StatusOK, bound(&order, r))
}

// validated refuses an order with every rule it breaks, joined by errors.Join one to a line.
func validated(w http.ResponseWriter, r *http.Request) {
	var order Order
	if err := json.NewDecoder(r.Body).Decode(&order); err != nil {
		refuse(w, err)
		return
	}
	if broken := slices.Collect(order.broken()); len(broken) > 0 {
		refuse(w, errors.Join(broken...))
		return
	}
	respond(w, http.StatusOK, bound(&order, r))
}

// validatedToFirstError refuses an order with the first rule it breaks, and checks no further.
func validatedToFirstError(w http.ResponseWriter, r *http.Request) {
	var order Order
	if err := json.NewDecoder(r.Body).Decode(&order); err != nil {
		refuse(w, err)
		return
	}
	if err := first(order.broken()); err != nil {
		refuse(w, err)
		return
	}
	respond(w, http.StatusOK, bound(&order, r))
}

// rb:wiring body.*
// broken yields each rule of the order it breaks, in the order Order declares its fields, and
// names the field as the client sent it. A caller that stops ranging stops the check there.
func (o *Order) broken() iter.Seq[error] {
	return func(yield func(error) bool) {
		if o.CustomerID <= 0 && !yield(errors.New("customerId: must be greater than 0")) {
			return
		}
		if o.Status == "" && !yield(errors.New("status: must not be empty")) {
			return
		}
		if len(o.Lines) == 0 && !yield(errors.New("lines: must not be empty")) {
			return
		}
		for i, line := range o.Lines {
			if line.ProductID <= 0 && !yield(fmt.Errorf("lines[%d].productId: must be greater than 0", i)) {
				return
			}
			if line.Qty <= 0 && !yield(fmt.Errorf("lines[%d].qty: must be greater than 0", i)) {
				return
			}
		}
	}
}

// first is the first error a check yields, or nil when it yields none.
func first(check iter.Seq[error]) error {
	for err := range check {
		return err
	}
	return nil
}

// rb:end
