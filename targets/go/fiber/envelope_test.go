package main

import (
	"encoding/json"
	"fmt"
	"reflect"
	"sort"
	"testing"
)

// rb:test authorized.*,body.*,errors.*
// What an error endpoint has to answer, which is not what a 2xx endpoint has to answer.
//
// A 2xx body is the controlled variable and spec/expected.json pins it exactly. An error
// envelope is the framework's own contract, so what is held is the status, the kind of body,
// and the shape this target recorded: the envelope with the values taken out.
//
// The framework-agnostic `errors` block is deliberately not what this reads. That block says
// what the plan intends, and a framework may declare otherwise in the client-exception package
// beside it, which the conformance client reads. A suite reads what this target recorded.
func assertEnvelope(t *testing.T, a plannedRequest, got answer, target string) {
	t.Helper()
	recorded := recordedEnvelope(target, a.Key)
	if recorded == nil {
		t.Fatalf("%s: spec/expected.json records no envelope for %s", a.Key, target)
	}
	if status := int(recorded["status"].(float64)); got.Status != status {
		t.Fatalf("%s: expected %d, got %d", a.Key, status, got.Status)
	}
	if class := bodyClassOf(got.ContentType); class != recorded["body_class"] {
		t.Fatalf("%s: expected a %v body, got %s", a.Key, recorded["body_class"], class)
	}
	var body any
	if len(got.Raw) > 0 && json.Unmarshal(got.Raw, &body) != nil {
		body = "unparseable-json"
	}
	have := shapeOf(body, "")
	var want []string
	for _, s := range recorded["shape"].([]any) {
		want = append(want, s.(string))
	}
	sort.Strings(want)
	if !reflect.DeepEqual(have, want) {
		t.Fatalf("%s: the envelope shape moved: got %v, recorded %v", a.Key, have, want)
	}
}

// shapeOf is a port of shape_of() in harness/expected.py, which wrote the recorded shapes.
func shapeOf(node any, path string) []string {
	set := map[string]bool{}
	var walk func(any, string)
	walk = func(n any, p string) {
		switch x := n.(type) {
		case map[string]any:
			if len(x) == 0 {
				set[p+"{}"] = true
			}
			for k, v := range x {
				if p == "" {
					walk(v, k)
				} else {
					walk(v, p+"."+k)
				}
			}
		case []any:
			if len(x) == 0 {
				set[p+"[]"] = true
			}
			for _, v := range x {
				walk(v, p+"[]")
			}
		default:
			kind := map[string]string{"<nil>": "null", "string": "string", "bool": "bool",
				"float64": "number"}[fmt.Sprintf("%T", n)]
			if kind == "" {
				kind = "other"
			}
			set[p+":"+kind] = true
		}
	}
	walk(node, path)
	out := make([]string, 0, len(set))
	for s := range set {
		out = append(out, s)
	}
	sort.Strings(out)
	return out
}

// rb:end
