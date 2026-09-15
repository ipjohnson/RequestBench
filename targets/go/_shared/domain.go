// Package domain holds the behaviour shared by every Go target. Frameworks differ only in
// how they bind routes to these functions, so the measured delta is framework overhead.
package domain

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"errors"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync/atomic"
)

type Product struct {
	ID         int    `json:"id"`
	Name       string `json:"name"`
	Category   string `json:"category"`
	PriceCents int    `json:"price_cents"`
	InStock    bool   `json:"in_stock"`
}
type Review struct {
	ID        int    `json:"id"`
	ProductID int    `json:"product_id"`
	Stars     int    `json:"stars"`
	Body      string `json:"body"`
}
type Customer struct {
	ID      int    `json:"id"`
	Name    string `json:"name"`
	Email   string `json:"email"`
	Region  string `json:"region"`
	Created string `json:"created"`
}
type Line struct {
	ID         int `json:"id"`
	ProductID  int `json:"product_id"`
	Qty        int `json:"qty"`
	UnitCents  int `json:"unit_cents"`
	TotalCents int `json:"total_cents"`
}
type Order struct {
	ID         int    `json:"id"`
	CustomerID int    `json:"customer_id"`
	Status     string `json:"status"`
	Created    string `json:"created"`
	TotalCents int    `json:"total_cents"`
	Lines      []Line `json:"lines"`
}

type fixture struct {
	Products  []Product             `json:"products"`
	Customers []Customer            `json:"customers"`
	Orders    []Order               `json:"orders"`
	Reviews   map[string][]Review   `json:"reviews"`
	Payloads  map[string]payloadDoc `json:"payloads"`
	Auth      authDoc               `json:"auth"`
}

var (
	Products  []Product
	Customers []Customer
	Orders    []Order
	Reviews   map[string][]Review

	payloads map[string]payloadDoc
	auth     authDoc
	serial   atomic.Uint64

	productByID  map[int]*Product
	customerByID map[int]*Customer
	orderByID    map[int]*Order
	ordersByCust map[int][]*Order
	custsByRegion map[string][]*Customer
)

// ErrNotFound is the sentinel every lookup returns; handlers map it to 404.
var ErrNotFound = errors.New("not_found")

// NextOrderID is the id a created order would get. The fixture holds 1..1000, so it is
// 1001: synthetic and deterministic, which is all a Location header needs when nothing
// is persisted. Set by Load.
var NextOrderID int

func Load(path string) error {
	raw, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	var f fixture
	if err := json.Unmarshal(raw, &f); err != nil {
		return err
	}
	Products, Customers, Orders, Reviews = f.Products, f.Customers, f.Orders, f.Reviews
	payloads, auth = f.Payloads, f.Auth

	productByID = make(map[int]*Product, len(Products))
	for i := range Products {
		productByID[Products[i].ID] = &Products[i]
	}
	customerByID = make(map[int]*Customer, len(Customers))
	custsByRegion = map[string][]*Customer{}
	for i := range Customers {
		c := &Customers[i]
		customerByID[c.ID] = c
		custsByRegion[c.Region] = append(custsByRegion[c.Region], c)
	}
	NextOrderID = len(Orders) + 1
	orderByID = make(map[int]*Order, len(Orders))
	ordersByCust = map[int][]*Order{}
	for i := range Orders {
		o := &Orders[i]
		orderByID[o.ID] = o
		ordersByCust[o.CustomerID] = append(ordersByCust[o.CustomerID], o)
	}
	return nil
}

func atoi(s string) (int, bool) {
	n, err := strconv.Atoi(s)
	return n, err == nil
}

func GetProduct(id string) (*Product, error) {
	n, ok := atoi(id)
	if !ok {
		return nil, ErrNotFound
	}
	if p, ok := productByID[n]; ok {
		return p, nil
	}
	return nil, ErrNotFound
}
func GetCustomer(id string) (*Customer, error) {
	n, ok := atoi(id)
	if !ok {
		return nil, ErrNotFound
	}
	if c, ok := customerByID[n]; ok {
		return c, nil
	}
	return nil, ErrNotFound
}
func GetOrder(id string) (*Order, error) {
	n, ok := atoi(id)
	if !ok {
		return nil, ErrNotFound
	}
	if o, ok := orderByID[n]; ok {
		return o, nil
	}
	return nil, ErrNotFound
}
func JSONSmall() map[string]string { return map[string]string{"message": "Hello, World!"} }

func GetOrderLines(oid string) ([]Line, error) {
	o, err := GetOrder(oid)
	if err != nil {
		return nil, err
	}
	return o.Lines, nil
}
func GetOrderLine(oid, lid string) (*Line, error) {
	o, err := GetOrder(oid)
	if err != nil {
		return nil, err
	}
	n, ok := atoi(lid)
	if !ok {
		return nil, ErrNotFound
	}
	for i := range o.Lines {
		if o.Lines[i].ID == n {
			return &o.Lines[i], nil
		}
	}
	return nil, ErrNotFound
}
func GetCustomerOrders(cid string) ([]*Order, error) {
	c, err := GetCustomer(cid)
	if err != nil {
		return nil, err
	}
	os := ordersByCust[c.ID]
	if os == nil {
		os = []*Order{}
	}
	return os, nil
}
func GetCustomerOrder(cid, oid string) (*Order, error) {
	o, err := GetOrder(oid)
	if err != nil {
		return nil, err
	}
	n, ok := atoi(cid)
	if !ok || o.CustomerID != n {
		return nil, ErrNotFound
	}
	return o, nil
}
func GetProductReviews(pid string) ([]Review, error) {
	p, err := GetProduct(pid)
	if err != nil {
		return nil, err
	}
	rs := Reviews[strconv.Itoa(p.ID)]
	if rs == nil {
		rs = []Review{}
	}
	return rs, nil
}
func GetRegionCustomers(region string) ([]*Customer, error) {
	cs, ok := custsByRegion[region]
	if !ok {
		return nil, ErrNotFound
	}
	return cs, nil
}

// ---- query families -------------------------------------------------------

type OrdersPage struct {
	Page  int      `json:"page"`
	Size  int      `json:"size"`
	Total int      `json:"total"`
	Items []*Order `json:"items"`
}
type ProductsList struct {
	Total int        `json:"total"`
	Items []*Product `json:"items"`
}
type CustomersList struct {
	Total int         `json:"total"`
	Sort  string      `json:"sort"`
	Items []*Customer `json:"items"`
}
type SearchResult struct {
	Term   string     `json:"term"`
	Limit  int        `json:"limit"`
	Offset int        `json:"offset"`
	Sort   string     `json:"sort"`
	Total  int        `json:"total"`
	Items  []*Product `json:"items"`
}

func qint(q map[string][]string, k string) int {
	if v, ok := q[k]; ok && len(v) > 0 {
		if n, err := strconv.Atoi(v[0]); err == nil {
			return n
		}
	}
	return 0
}
func qstr(q map[string][]string, k string) string {
	if v, ok := q[k]; ok && len(v) > 0 {
		return v[0]
	}
	return ""
}

func ListOrders(q map[string][]string) OrdersPage {
	page := max(0, qint(q, "page"))
	size := qint(q, "size")
	if size == 0 {
		size = 25
	}
	size = min(100, max(1, size))
	rows := make([]*Order, 0, len(Orders))
	status := qstr(q, "status")
	for i := range Orders {
		if status == "" || Orders[i].Status == status {
			rows = append(rows, &Orders[i])
		}
	}
	start := min(page*size, len(rows))
	end := min(start+size, len(rows))
	return OrdersPage{Page: page, Size: size, Total: len(rows), Items: rows[start:end]}
}

func ListProducts(q map[string][]string) ProductsList {
	cat := qstr(q, "category")
	minp, maxp := qstr(q, "min_price"), qstr(q, "max_price")
	lo, hi := 0, int(^uint(0)>>1)
	if minp != "" {
		lo, _ = strconv.Atoi(minp)
	}
	if maxp != "" {
		hi, _ = strconv.Atoi(maxp)
	}
	rows := make([]*Product, 0, len(Products))
	for i := range Products {
		p := &Products[i]
		if cat != "" && p.Category != cat {
			continue
		}
		if (minp != "" || maxp != "") && (p.PriceCents < lo*100 || p.PriceCents > hi*100) {
			continue
		}
		rows = append(rows, p)
	}
	return ProductsList{Total: len(rows), Items: rows}
}

func ListCustomers(q map[string][]string) CustomersList {
	term := qstr(q, "q")
	rows := make([]*Customer, 0, len(Customers))
	for i := range Customers {
		c := &Customers[i]
		if term == "" || strings.Contains(c.Name, term) || strings.Contains(c.Email, term) {
			rows = append(rows, c)
		}
	}
	key := "name"
	if qstr(q, "sort") == "created" {
		key = "created"
	}
	sort.SliceStable(rows, func(i, j int) bool {
		a, b := rows[i].Name, rows[j].Name
		if key == "created" {
			a, b = rows[i].Created, rows[j].Created
		}
		if a != b {
			return a < b
		}
		return rows[i].ID < rows[j].ID
	})
	total := len(rows)
	return CustomersList{Total: total, Sort: key, Items: rows[:min(50, total)]}
}

func Search(q map[string][]string) SearchResult {
	limit := qint(q, "limit")
	if limit == 0 {
		limit = 25
	}
	limit = min(100, max(1, limit))
	offset := max(0, qint(q, "offset"))
	term := qstr(q, "q")
	hits := make([]*Product, 0, len(Products))
	for i := range Products {
		if strings.Contains(Products[i].Name, term) {
			hits = append(hits, &Products[i])
		}
	}
	key := "name"
	if qstr(q, "sort") == "total" {
		key = "price_cents"
	}
	desc := qstr(q, "dir") == "desc"
	sort.SliceStable(hits, func(i, j int) bool {
		var less bool
		if key == "price_cents" {
			if hits[i].PriceCents != hits[j].PriceCents {
				less = hits[i].PriceCents < hits[j].PriceCents
			} else {
				return hits[i].ID < hits[j].ID
			}
		} else {
			if hits[i].Name != hits[j].Name {
				less = hits[i].Name < hits[j].Name
			} else {
				return hits[i].ID < hits[j].ID
			}
		}
		if desc {
			return !less
		}
		return less
	})
	start := min(offset, len(hits))
	end := min(start+limit, len(hits))
	return SearchResult{Term: term, Limit: limit, Offset: offset, Sort: key,
		Total: len(hits), Items: hits[start:end]}
}

// ---- composition families -------------------------------------------------

type RecentOrder struct {
	ID         int    `json:"id"`
	Created    string `json:"created"`
	TotalCents int    `json:"total_cents"`
}
type Summary struct {
	Customer      *Customer      `json:"customer"`
	OrderCount    int            `json:"order_count"`
	LifetimeCents int            `json:"lifetime_cents"`
	ByStatus      map[string]int `json:"by_status"`
	Recent        []RecentOrder  `json:"recent"`
}
type LineFull struct {
	ID         int      `json:"id"`
	ProductID  int      `json:"product_id"`
	Qty        int      `json:"qty"`
	UnitCents  int      `json:"unit_cents"`
	TotalCents int      `json:"total_cents"`
	Product    *Product `json:"product"`
}
type FullOrder struct {
	ID         int        `json:"id"`
	CustomerID int        `json:"customer_id"`
	Status     string     `json:"status"`
	Created    string     `json:"created"`
	TotalCents int        `json:"total_cents"`
	Lines      []LineFull `json:"lines"`
	Customer   *Customer  `json:"customer"`
}
type TopOrder struct {
	ID         int `json:"id"`
	TotalCents int `json:"total_cents"`
}
type Report struct {
	Region       string     `json:"region"`
	Customers    int        `json:"customers"`
	Orders       int        `json:"orders"`
	RevenueCents int        `json:"revenue_cents"`
	Top          []TopOrder `json:"top"`
}
type Related struct {
	Product *Product   `json:"product"`
	Related []*Product `json:"related"`
}
type RegionCount struct {
	Region    string `json:"region"`
	Customers int    `json:"customers"`
}
type Board struct {
	Products     int            `json:"products"`
	Customers    int            `json:"customers"`
	Orders       int            `json:"orders"`
	RevenueCents int            `json:"revenue_cents"`
	ByStatus     map[string]int `json:"by_status"`
	ByRegion     []RegionCount  `json:"by_region"`
}

func CustomerSummary(cid string) (*Summary, error) {
	c, err := GetCustomer(cid)
	if err != nil {
		return nil, err
	}
	os := ordersByCust[c.ID]
	s := &Summary{Customer: c, OrderCount: len(os), ByStatus: map[string]int{},
		Recent: []RecentOrder{}}
	for _, o := range os {
		s.LifetimeCents += o.TotalCents
		s.ByStatus[o.Status]++
	}
	for _, o := range os[max(0, len(os)-5):] {
		s.Recent = append(s.Recent, RecentOrder{o.ID, o.Created, o.TotalCents})
	}
	return s, nil
}

func OrderFull(oid string) (*FullOrder, error) {
	o, err := GetOrder(oid)
	if err != nil {
		return nil, err
	}
	lines := make([]LineFull, 0, len(o.Lines))
	for _, l := range o.Lines {
		lines = append(lines, LineFull{l.ID, l.ProductID, l.Qty, l.UnitCents, l.TotalCents,
			productByID[l.ProductID]})
	}
	return &FullOrder{o.ID, o.CustomerID, o.Status, o.Created, o.TotalCents, lines,
		customerByID[o.CustomerID]}, nil
}

func RegionReport(region string) (*Report, error) {
	cs, ok := custsByRegion[region]
	if !ok {
		return nil, ErrNotFound
	}
	var os []*Order
	for _, c := range cs {
		os = append(os, ordersByCust[c.ID]...)
	}
	r := &Report{Region: region, Customers: len(cs), Orders: len(os), Top: []TopOrder{}}
	for _, o := range os {
		r.RevenueCents += o.TotalCents
	}
	sorted := append([]*Order(nil), os...)
	sort.SliceStable(sorted, func(i, j int) bool {
		if sorted[i].TotalCents != sorted[j].TotalCents {
			return sorted[i].TotalCents > sorted[j].TotalCents
		}
		return sorted[i].ID < sorted[j].ID
	})
	for _, o := range sorted[:min(10, len(sorted))] {
		r.Top = append(r.Top, TopOrder{o.ID, o.TotalCents})
	}
	return r, nil
}

func RelatedProducts(pid string) (*Related, error) {
	p, err := GetProduct(pid)
	if err != nil {
		return nil, err
	}
	rel := make([]*Product, 0, 10)
	for i := range Products {
		x := &Products[i]
		if x.Category == p.Category && x.ID != p.ID && len(rel) < 10 {
			rel = append(rel, x)
		}
	}
	return &Related{Product: p, Related: rel}, nil
}

func Dashboard() *Board {
	b := &Board{Products: len(Products), Customers: len(Customers), Orders: len(Orders),
		ByStatus: map[string]int{}, ByRegion: []RegionCount{}}
	for i := range Orders {
		b.RevenueCents += Orders[i].TotalCents
		b.ByStatus[Orders[i].Status]++
	}
	regions := make([]string, 0, len(custsByRegion))
	for r := range custsByRegion {
		regions = append(regions, r)
	}
	sort.Strings(regions)
	for _, r := range regions {
		b.ByRegion = append(b.ByRegion, RegionCount{r, len(custsByRegion[r])})
	}
	return b
}

// ---- validation -----------------------------------------------------------
// Error field order matches the Node reference exactly; conform.py fingerprints the
// 422 bodies, so a reordered check here shows up as a conformance failure.

type FieldError struct {
	Field string `json:"field"`
	Rule  string `json:"rule"`
}
type ValidationError struct{ Errors []FieldError }

func (e *ValidationError) Error() string { return "validation failed" }

type ValidatedOrder struct {
	CustomerID int    `json:"customer_id"`
	Status     string `json:"status"`
	Lines      []Line `json:"lines"`
	TotalCents int    `json:"total_cents"`
}
type ValidatedOrderWithID struct {
	ID int `json:"id"`
	ValidatedOrder
}
type ValidatedCustomer struct {
	Name   string `json:"name"`
	Email  string `json:"email"`
	Region string `json:"region"`
}
type ValidatedProduct struct {
	Name       string `json:"name"`
	Category   string `json:"category"`
	PriceCents int    `json:"price_cents"`
}
type EchoResult struct {
	Received any `json:"received"`
	Bytes    int `json:"bytes"`
}

func isInt(v any) bool {
	f, ok := v.(float64)
	return ok && f == float64(int64(f))
}

func reqField(errs *[]FieldError, m map[string]any, field, typ string) {
	v, present := m[field]
	if !present || v == nil {
		*errs = append(*errs, FieldError{field, "required"})
		return
	}
	switch typ {
	case "int":
		if !isInt(v) {
			*errs = append(*errs, FieldError{field, "int"})
		}
	case "string":
		if _, ok := v.(string); !ok {
			*errs = append(*errs, FieldError{field, "string"})
		}
	case "array":
		if _, ok := v.([]any); !ok {
			*errs = append(*errs, FieldError{field, "array"})
		}
	}
}

// ValidateOrder reports every problem it finds. ValidateOrderFirst stops at the first,
// which is what body.rejected_all minus body.rejected_first states as a number: the same
// walk in the same order, differing only in where it gives up.
func ValidateOrder(m map[string]any) (*ValidatedOrder, error) { return validateOrder(m, false) }

func ValidateOrderFirst(m map[string]any) (*ValidatedOrder, error) { return validateOrder(m, true) }

func validateOrder(m map[string]any, firstError bool) (*ValidatedOrder, error) {
	var errs []FieldError
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
			errs = append(errs, FieldError{"lines", "min_length"})
		}
		for i, e := range raw {
			if bail() {
				break
			}
			l, _ := e.(map[string]any)
			if !isInt(l["product_id"]) {
				errs = append(errs, FieldError{"lines[" + strconv.Itoa(i) + "].product_id", "int"})
			}
			q, ok := l["qty"].(float64)
			if !bail() && (!ok || !isInt(l["qty"]) || q < 1) {
				errs = append(errs, FieldError{"lines[" + strconv.Itoa(i) + "].qty", "min"})
			}
		}
	}
	if len(errs) > 0 {
		return nil, &ValidationError{errs}
	}
	lines := make([]Line, 0, len(raw))
	total := 0
	for i, e := range raw {
		l := e.(map[string]any)
		pid, qty := int(l["product_id"].(float64)), int(l["qty"].(float64))
		unit := 0
		if p, ok := productByID[pid]; ok {
			unit = p.PriceCents
		}
		lines = append(lines, Line{i + 1, pid, qty, unit, unit * qty})
		total += unit * qty
	}
	return &ValidatedOrder{int(m["customer_id"].(float64)), m["status"].(string), lines, total}, nil
}

func ValidateCustomer(m map[string]any) (*ValidatedCustomer, error) {
	var errs []FieldError
	reqField(&errs, m, "name", "string")
	reqField(&errs, m, "email", "string")
	reqField(&errs, m, "region", "string")
	if e, ok := m["email"].(string); ok && !strings.Contains(e, "@") {
		errs = append(errs, FieldError{"email", "format"})
	}
	if len(errs) > 0 {
		return nil, &ValidationError{errs}
	}
	return &ValidatedCustomer{strings.TrimSpace(m["name"].(string)),
		strings.ToLower(m["email"].(string)), m["region"].(string)}, nil
}

func ValidateProduct(m map[string]any) (*ValidatedProduct, error) {
	var errs []FieldError
	reqField(&errs, m, "name", "string")
	reqField(&errs, m, "category", "string")
	reqField(&errs, m, "price_cents", "int")
	if p, ok := m["price_cents"].(float64); ok && isInt(m["price_cents"]) && p < 0 {
		errs = append(errs, FieldError{"price_cents", "min"})
	}
	if len(errs) > 0 {
		return nil, &ValidationError{errs}
	}
	return &ValidatedProduct{m["name"].(string), m["category"].(string),
		int(m["price_cents"].(float64))}, nil
}

func ValidateLine(m map[string]any) (*Line, error) {
	var errs []FieldError
	reqField(&errs, m, "product_id", "int")
	reqField(&errs, m, "qty", "int")
	if len(errs) > 0 {
		return nil, &ValidationError{errs}
	}
	pid, qty := int(m["product_id"].(float64)), int(m["qty"].(float64))
	unit := 0
	if p, ok := productByID[pid]; ok {
		unit = p.PriceCents
	}
	return &Line{1, pid, qty, unit, unit * qty}, nil
}

func PatchCustomer(cid string, m map[string]any) (*Customer, error) {
	c, err := GetCustomer(cid)
	if err != nil {
		return nil, err
	}
	out := *c
	if n, ok := m["name"].(string); ok && n != "" {
		out.Name = n
	}
	if r, ok := m["region"].(string); ok && r != "" {
		out.Region = r
	}
	return &out, nil
}

func Echo(body any) EchoResult {
	b, _ := json.Marshal(body)
	return EchoResult{Received: body, Bytes: len(b)}
}

// Boom is the deliberate unhandled failure behind GET /boom.
type Boom struct{}

func (Boom) Error() string { return "deliberate unhandled failure" }

// ---- blend-v2 ---------------------------------------------------------------
//
// The payload is the controlled variable: three fixed responses that every feature family
// reuses unchanged, so subtracting a base endpoint from its arm leaves the feature and
// nothing else.

// PayloadBody is the response json.*, compressed.*, cached.* and template.* all serve.
type PayloadBody struct {
	Count int       `json:"count"`
	Items []Product `json:"items"`
	Size  string    `json:"size"`
}

type payloadDoc struct {
	Body  PayloadBody `json:"body"`
	Bytes int         `json:"bytes"`
	ETag  string      `json:"etag"`
	HTML  string      `json:"html"`
}

type authDoc struct {
	Token      string `json:"token"`
	WrongToken string `json:"wrong_token"`
}

// Payload is not pre-serialized. json.small against json.large is one fixture read, one
// serialize and one write at three sizes; handing back a cached string would measure none
// of it.
func Payload(size string) PayloadBody { return payloads[size].Body }

// ETagOf is the value pinned in the fixture, so what a target spends is emitting the
// header and comparing it rather than hashing a body.
func ETagOf(size string) string { return payloads[size].ETag }

// GzipLevel is pinned across every language. Compression cost is dominated by codec and
// level, not by framework, so an unpinned level makes compressed.* a zlib benchmark.
const GzipLevel = 6

// Gzip compresses at the pinned level. Targets whose framework brings its own middleware
// use that instead and configure it to this level.
func Gzip(b []byte) []byte {
	var out bytes.Buffer
	w, _ := gzip.NewWriterLevel(&out, GzipLevel)
	_, _ = w.Write(b)
	_ = w.Close()
	return out.Bytes()
}

// NextSerial is x-rb-serial, monotonic per process. A response served from a cache
// anywhere in the path, or precomputed at boot, repeats a number it did not increment,
// and identical bytes are the whole point of the fingerprint. Atomic because the server is
// concurrent and a torn counter would fail the gate for a reason that is not the target's.
func NextSerial() string { return strconv.FormatUint(serial.Add(1), 10) }

// TokenOK compares the bearer token. The denial arm's token differs only in its last
// character, so this walks the whole string rather than failing on length.
func TokenOK(header string) bool {
	const prefix = "Bearer "
	return strings.HasPrefix(header, prefix) && header[len(prefix):] == auth.Token
}

// LeafCount walks the parsed body. Without a field derived from the parsed structure a
// target can pipe request bytes straight to the response and never parse, and the
// fingerprint sorts keys before hashing so even a reordering is invisible.
func LeafCount(v any) int {
	switch t := v.(type) {
	case map[string]any:
		n := 0
		for _, x := range t {
			n += LeafCount(x)
		}
		return n
	case []any:
		n := 0
		for _, x := range t {
			n += LeafCount(x)
		}
		return n
	default:
		return 1
	}
}

type BindResult struct {
	Fields int `json:"fields"`
	Bytes  int `json:"bytes"`
	Echo   any `json:"echo"`
}

func BindEcho(body any) BindResult {
	b, _ := json.Marshal(body)
	return BindResult{Fields: LeafCount(body), Bytes: len(b), Echo: body}
}

// The query arms have to echo the coerced values or the parse can be skipped and the
// endpoint measures nothing.
type QueryOne struct {
	Page int `json:"page"`
}
type QueryMany struct {
	Page     int    `json:"page"`
	Size     int    `json:"size"`
	Status   string `json:"status"`
	Category string `json:"category"`
	Sort     string `json:"sort"`
	Q        string `json:"q"`
	MinPrice int    `json:"min_price"`
	MaxPrice int    `json:"max_price"`
}

func CoerceOne(q map[string][]string) QueryOne { return QueryOne{Page: qint(q, "page")} }

func CoerceMany(q map[string][]string) QueryMany {
	return QueryMany{
		Page: qint(q, "page"), Size: qint(q, "size"),
		Status: qstr(q, "status"), Category: qstr(q, "category"),
		Sort: qstr(q, "sort"), Q: qstr(q, "q"),
		MinPrice: qint(q, "min_price"), MaxPrice: qint(q, "max_price"),
	}
}

// DomainFilter, DomainJoin and DomainAggregate do the work the spec pins. Conformance
// compares bytes, and a precomputed page produces the same bytes as a computed one, so
// this is the one family where two conforming implementations can do wildly different
// amounts of work. The predicate runs over the live list on every request, the join walks
// the lines, and the aggregate folds every matching order. No index, no memoization.
func DomainFilter(q map[string][]string) OrdersPage {
	page := max(0, qint(q, "page"))
	size := qint(q, "size")
	if size == 0 {
		size = 25
	}
	size = min(100, max(1, size))
	status := qstr(q, "status")
	rows := make([]*Order, 0, len(Orders))
	for i := range Orders {
		if Orders[i].Status == status {
			rows = append(rows, &Orders[i])
		}
	}
	start := min(page*size, len(rows))
	end := min(start+size, len(rows))
	return OrdersPage{Page: page, Size: size, Total: len(rows), Items: rows[start:end]}
}

type JoinSummary struct {
	Customer      *Customer     `json:"customer"`
	OrderCount    int           `json:"order_count"`
	LifetimeCents int           `json:"lifetime_cents"`
	LineCount     int           `json:"line_count"`
	Units         int           `json:"units"`
	Recent        []RecentOrder `json:"recent"`
}

func DomainJoin(cid string) (*JoinSummary, error) {
	id, ok := atoi(cid)
	if !ok {
		return nil, ErrNotFound
	}
	c, ok := customerByID[id]
	if !ok {
		return nil, ErrNotFound
	}
	out := &JoinSummary{Customer: c, Recent: []RecentOrder{}}
	for i := range Orders {
		o := &Orders[i]
		if o.CustomerID != c.ID {
			continue
		}
		out.OrderCount++
		out.LifetimeCents += o.TotalCents
		for _, l := range o.Lines {
			out.LineCount++
			out.Units += l.Qty
		}
		out.Recent = append(out.Recent, RecentOrder{o.ID, o.Created, o.TotalCents})
	}
	if n := len(out.Recent); n > 5 {
		out.Recent = out.Recent[n-5:]
	}
	return out, nil
}

func DomainAggregate(region string) (*Report, error) {
	inRegion := make(map[int]struct{}, len(Customers))
	for i := range Customers {
		if Customers[i].Region == region {
			inRegion[Customers[i].ID] = struct{}{}
		}
	}
	if len(inRegion) == 0 {
		return nil, ErrNotFound
	}
	r := &Report{Region: region, Customers: len(inRegion), Top: []TopOrder{}}
	matched := make([]*Order, 0, len(Orders))
	for i := range Orders {
		o := &Orders[i]
		if _, ok := inRegion[o.CustomerID]; !ok {
			continue
		}
		r.Orders++
		r.RevenueCents += o.TotalCents
		matched = append(matched, o)
	}
	sort.SliceStable(matched, func(i, j int) bool {
		if matched[i].TotalCents != matched[j].TotalCents {
			return matched[i].TotalCents > matched[j].TotalCents
		}
		return matched[i].ID < matched[j].ID
	})
	for _, o := range matched[:min(10, len(matched))] {
		r.Top = append(r.Top, TopOrder{o.ID, o.TotalCents})
	}
	return r, nil
}

// ---- the strings every target answers with ----------------------------------
//
// Spelled once so five targets cannot drift on a word, which is the kind of difference
// that reads as a framework result.

const Cacheable = "public, max-age=60"

func NotFoundBody() map[string]string { return map[string]string{"error": "not_found"} }

func ForbiddenBody() map[string]string { return map[string]string{"error": "forbidden"} }

func InvalidBody(errs []FieldError) map[string]any {
	return map[string]any{"error": "validation_failed", "errors": errs}
}

// MalformedBody is the 422 every target answers when the request body is not JSON at all.
// It is the same error the validator raises so errors.malformed and body.rejected_* share
// a shape.
func MalformedBody() *ValidationError {
	return &ValidationError{Errors: []FieldError{{Field: "body", Rule: "json"}}}
}

// CreatedLocation is where a created order points. Built by concatenation rather than a
// format string: "/domain/orders/%d" is indistinguishable from a route with a capture, and
// harness/snippets.py then finds the domain routes in two places and refuses to guess.
func CreatedLocation() string { return "/domain/orders/" + strconv.Itoa(NextOrderID) }
