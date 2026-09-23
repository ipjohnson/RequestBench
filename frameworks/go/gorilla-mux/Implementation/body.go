package implementation

import (
	"encoding/json"
	"errors"
	"net/http"
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"
	"github.com/gorilla/mux"
)

// Order is the body the bind rows send, bound with its types and none of its rules.
type Order struct {
	CustomerID int    `json:"customerId"`
	Status     string `json:"status"`
	Lines      []Line `json:"lines"`
}

type Line struct {
	ProductID int `json:"productId"`
	Qty       int `json:"qty"`
}

// rb:wiring body.*
// validate is go-playground's validator. It names a field by its json name, the name the
// client sent, through the hook go-playground offers for that.
var validate = func() *validator.Validate {
	v := validator.New(validator.WithRequiredStructEnabled())
	v.RegisterTagNameFunc(func(field reflect.StructField) string {
		name, _, _ := strings.Cut(field.Tag.Get("json"), ",")
		if name == "-" {
			return ""
		}
		return name
	})
	return v
}()

// CheckedOrder carries the rules orderRequest states as validate tags.
type CheckedOrder struct {
	CustomerID int           `json:"customerId" validate:"gt=0"`
	Status     string        `json:"status" validate:"required"`
	Lines      []CheckedLine `json:"lines" validate:"min=1,dive"`
}

type CheckedLine struct {
	ProductID int `json:"productId" validate:"gt=0"`
	Qty       int `json:"qty" validate:"gt=0"`
}

// rb:end

// Bound is what a bind or validate row answers: the order back, with the leaves the handler
// found in it and the bytes it received.
type Bound struct {
	Fields int   `json:"fields"`
	Bytes  int64 `json:"bytes"`
	Echo   any   `json:"echo"`
}

// bound counts customerId and status, and a productId and a qty per line.
func bound(order any, lines int, request *http.Request) Bound {
	return Bound{Fields: 2 + 2*lines, Bytes: request.ContentLength, Echo: order}
}

// bodyRoutes decode the order with encoding/json on every route, because mux binds nothing.
// The validate routes then hand it to go-playground's validator.
func bodyRoutes(r *mux.Router) {
	r.HandleFunc("/body/bind/small", bind).Methods(http.MethodPost)

	r.HandleFunc("/body/bind/medium", bind).Methods(http.MethodPost)

	r.HandleFunc("/body/validate/small", validated).Methods(http.MethodPost)

	r.HandleFunc("/body/validate/medium", validated).Methods(http.MethodPost)

	r.HandleFunc("/body/validate/first-error", validatedToFirstError).Methods(http.MethodPost)
}

func bind(w http.ResponseWriter, r *http.Request) {
	var order Order
	if err := json.NewDecoder(r.Body).Decode(&order); err != nil {
		refuse(w, err)
		return
	}
	respond(w, http.StatusOK, bound(&order, len(order.Lines), r))
}

func validated(w http.ResponseWriter, r *http.Request) {
	var order CheckedOrder
	if err := json.NewDecoder(r.Body).Decode(&order); err != nil {
		refuse(w, err)
		return
	}
	if err := validate.Struct(&order); err != nil {
		refuse(w, err)
		return
	}
	respond(w, http.StatusOK, bound(&order, len(order.Lines), r))
}

func validatedToFirstError(w http.ResponseWriter, r *http.Request) {
	var order CheckedOrder
	if err := json.NewDecoder(r.Body).Decode(&order); err != nil {
		refuse(w, err)
		return
	}
	if err := firstFailure(&order); err != nil {
		refuse(w, err)
		return
	}
	respond(w, http.StatusOK, bound(&order, len(order.Lines), r))
}

// rb:wiring body.*
// checkedFields are CheckedOrder's fields in the order they are declared, as the validator
// names them in a namespace.
var checkedFields = func() []string {
	t := reflect.TypeFor[CheckedOrder]()
	names := make([]string, t.NumField())
	for i := range names {
		names[i] = t.Name() + "." + t.Field(i).Name
	}
	return names
}()

// firstFailure runs the validator over one field at a time, the field's own items included,
// and answers the first failure of the first field that has one. go-playground reports every
// rule a body breaks and has no setting to stop at the first.
func firstFailure(order *CheckedOrder) error {
	for _, field := range checkedFields {
		err := validate.StructFiltered(order, func(namespace []byte) bool { return !within(string(namespace), field) })
		var failed validator.ValidationErrors
		if errors.As(err, &failed) {
			return failed[:1]
		}
		if err != nil {
			return err
		}
	}
	return nil
}

// within says whether a validator namespace is the field or something inside it.
func within(namespace, field string) bool {
	rest, ok := strings.CutPrefix(namespace, field)
	return ok && (rest == "" || rest[0] == '.' || rest[0] == '[')
}

// rb:end
