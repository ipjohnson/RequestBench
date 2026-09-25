package unittests

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	sdk "github.com/ipjohnson/RequestBench/frameworks/go/huma/Client"
)

// The client oapi-codegen generates from Huma's document, sending its requests to the ServeMux
// served by httptest. The test checks the client rather than the framework, so no test mark
// names it.
func TestTheGeneratedClientReadsTheAnswers(t *testing.T) {
	server := httptest.NewServer(mux)
	defer server.Close()
	c, err := sdk.NewClientWithResponses(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()

	small, err := c.GetJsonSmallWithResponse(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if small.JSON200 == nil || small.JSON200.Size != "small" || small.JSON200.Count != 1 {
		t.Fatalf("json.small read as %+v", small.JSON200)
	}

	item, err := c.GetItemsByIdWithResponse(ctx, 17)
	if err != nil {
		t.Fatal(err)
	}
	if item.JSON200 == nil || item.JSON200.Id != 17 {
		t.Fatalf("row 17 read as %+v", item.JSON200)
	}

	lines := []sdk.CheckedLine{}
	refused, err := c.PostBodyValidateSmallWithResponse(ctx, sdk.PostBodyValidateSmallJSONRequestBody{CustomerId: 0, Status: "", Lines: &lines})
	if err != nil {
		t.Fatal(err)
	}
	if refused.StatusCode() != http.StatusUnprocessableEntity || refused.ApplicationproblemJSONDefault == nil || len(*refused.ApplicationproblemJSONDefault.Errors) != 3 {
		t.Fatalf("the refusal read as %d %s", refused.StatusCode(), refused.Body)
	}
}
