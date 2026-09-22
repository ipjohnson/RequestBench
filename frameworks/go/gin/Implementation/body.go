package implementation

import (
	"errors"
	"net/http"
	"reflect"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/validator/v10"
)

// Order is the body the bind and validate rows send, bound with its types and none of its rules.
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
// The validator names a field by its json name, the name the client sent, through the hook
// go-playground offers for that. Gin hands out its validator for such settings.
func init() {
	binding.Validator.Engine().(*validator.Validate).RegisterTagNameFunc(func(field reflect.StructField) string {
		name, _, _ := strings.Cut(field.Tag.Get("json"), ",")
		if name == "-" {
			return ""
		}
		return name
	})
}

// CheckedOrder carries the rules orderRequest states as binding tags, which gin's binder hands
// to go-playground's validator once the body is decoded.
type CheckedOrder struct {
	CustomerID int           `json:"customerId" binding:"gt=0"`
	Status     string        `json:"status" binding:"required"`
	Lines      []CheckedLine `json:"lines" binding:"min=1,dive"`
}

type CheckedLine struct {
	ProductID int `json:"productId" binding:"gt=0"`
	Qty       int `json:"qty" binding:"gt=0"`
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

// bodyRoutes bind the order with ShouldBindJSON on every route. On the validate routes the type
// carries binding tags, so gin runs the validator before the handler sees the order.
func bodyRoutes(r *gin.Engine) {
	r.POST("/body/bind/small", bind)

	r.POST("/body/bind/medium", bind)

	r.POST("/body/validate/small", validate)

	r.POST("/body/validate/medium", validate)

	r.POST("/body/validate/first-error", validateToFirstError)
}

func bind(c *gin.Context) {
	var order Order
	if err := c.ShouldBindJSON(&order); err != nil {
		refuse(c, err)
		return
	}
	c.JSON(http.StatusOK, bound(&order, len(order.Lines), c.Request))
}

func validate(c *gin.Context) {
	var order CheckedOrder
	if err := c.ShouldBindJSON(&order); err != nil {
		refuse(c, err)
		return
	}
	c.JSON(http.StatusOK, bound(&order, len(order.Lines), c.Request))
}

// validateToFirstError binds the order without its rules and then checks them itself, because
// go-playground reports every rule a body breaks and has no setting to stop at the first.
func validateToFirstError(c *gin.Context) {
	var order Order
	if err := c.ShouldBindJSON(&order); err != nil {
		refuse(c, err)
		return
	}
	if err := firstFailure(order.checked()); err != nil {
		refuse(c, err)
		return
	}
	c.JSON(http.StatusOK, bound(&order, len(order.Lines), c.Request))
}

func (o Order) checked() *CheckedOrder {
	lines := make([]CheckedLine, len(o.Lines))
	for i, line := range o.Lines {
		lines[i] = CheckedLine(line)
	}
	return &CheckedOrder{CustomerID: o.CustomerID, Status: o.Status, Lines: lines}
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

// firstFailure runs the validator gin holds over one field at a time, the field's own items
// included, and answers the first failure of the first field that has one.
func firstFailure(order *CheckedOrder) error {
	engine := binding.Validator.Engine().(*validator.Validate)
	for _, field := range checkedFields {
		err := engine.StructFiltered(order, func(namespace []byte) bool { return !within(string(namespace), field) })
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
