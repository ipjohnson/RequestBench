package unittests

import "testing"

// rb:test query.one,query.many
func TestQuery(t *testing.T) {
	t.Run("query.one", func(t *testing.T) {
		assertOK(t, withEcho(t, "items.small.json", map[string]any{"page": 417.0}), get(t, "/query/one?page=417"))
	})

	t.Run("query.many", func(t *testing.T) {
		want := withEcho(t, "items.small.json", search())
		path := "/query/many?page=417&size=38&status=paid&category=garden&sort=created&q=alpha%20bravo&minPrice=1200&maxPrice=34000"
		assertOK(t, want, get(t, path))
	})
}

// search is query.many's eight values as the handler echoes them, the numbers as numbers.
func search() map[string]any {
	return map[string]any{
		"page": 417.0, "size": 38.0, "status": "paid", "category": "garden",
		"sort": "created", "q": "alpha bravo", "minPrice": 1200.0, "maxPrice": 34000.0,
	}
}
