# Hosts

A target is a framework plus a host. The framework decides how routes are bound to the
shared domain module; the host decides what invokes them.

Every `<framework>/app.js` exports two things:

    listen(port)   the framework's own server, started its own way
    handler        a (req, res) function, for a host that brings its own server

`container` calls `listen`, because what people deploy is the framework's own server.
The function hosts pass `handler` to theirs, because that is what actually happens on
Lambda, on Azure Functions and on Cloud Run. Neither is a wrapper around the other.

A host's overhead is part of what it measures. A framework on `gcp-func` is timed
through the Functions Framework, and that number is not comparable to the same framework
on `container`; the host is named on every row so the two are never read as one.
