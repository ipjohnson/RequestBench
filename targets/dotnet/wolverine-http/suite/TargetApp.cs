using Alba;
using Microsoft.AspNetCore.Http;
using RequestBench.Suite;

namespace RequestBench.WolverineTarget.Suite;

/// <summary>
/// The target, booted in process by Alba, which is what Wolverine's own documentation names
/// for HTTP tests.
///
/// Alba runs a scenario against the application's HttpContext, over TestServer like the four
/// beside it, rather than handing back an
/// HttpResponseMessage, so what a test reads is the response object the endpoint wrote to.
/// Wolverine compiles its endpoints at startup, which a test host pays for once here and
/// the measurement absorbs in warmup.
/// </summary>
public sealed class TargetApp : IAsyncLifetime
{
    public IAlbaHost Host { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        // Program.cs reads the fixture before the host is built, through the relative
        // fallback in DomainModel.FixturePath(). That fallback resolves against
        // targets/dotnet, which is not where a test host runs.
        Environment.SetEnvironmentVariable("RB_FIXTURE", Spec.FixturePath);
        Host = await AlbaHost.For<Program>();
    }

    public async Task DisposeAsync() => await Host.DisposeAsync();

    /// <summary>The four values the floor assertion compares, out of a scenario result.</summary>
    /// <remarks>
    /// The body is read off the response stream rather than through ReadAsText, because a
    /// gzipped response is not text and decoding it here would be the transport undoing what
    /// the test is checking. TestServer hands back a forward-only ResponseBodyReaderStream,
    /// so it is read once and never rewound.
    /// </remarks>
    public static (int Status, string ContentType, string Encoding, byte[] Raw) Answer(
        IScenarioResult result)
    {
        HttpResponse response = result.Context.Response;
        if (response.Body.CanSeek)
        {
            response.Body.Position = 0;
        }
        using MemoryStream copy = new();
        response.Body.CopyTo(copy);
        return ((int)response.StatusCode,
                response.ContentType ?? "",
                string.Join(", ", (string?[])response.Headers.ContentEncoding!),
                copy.ToArray());
    }

    /// <summary>Send one of an endpoint's planned requests, as an Alba scenario.</summary>
    /// <remarks>
    /// The method, path, headers and body all come from spec/plan.json. What is authored here
    /// is the scenario, which is the part that differs between targets.
    ///
    /// Alba asserts 200 unless told not to. The status spec/expected.json pins is the
    /// authority, and two of them would mean a wrong expectation could be masked by a
    /// scenario that happened to agree with the target.
    /// </remarks>
    public Task<IScenarioResult> Send(Ask ask) => Send(ask, ask.Headers);

    private async Task<IScenarioResult> Send(Ask ask, IDictionary<string, string> headers) =>
        await Host.Scenario(scenario =>
        {
            int query = ask.Path.IndexOf('?', StringComparison.Ordinal);
            string path = query < 0 ? ask.Path : ask.Path[..query];
            IUrlExpression verb = ask.Method switch
            {
                "GET" => scenario.Get,
                "POST" => scenario.Post,
                "PUT" => scenario.Put,
                "PATCH" => scenario.Patch,
                "DELETE" => scenario.Delete,
                _ => throw new InvalidOperationException($"no verb for {ask.Method}"),
            };
            if (ask.Body is string body)
            {
                verb.Text(body).ContentType("application/json").ToUrl(path);
            }
            else
            {
                verb.Url(path);
            }
            foreach ((string name, string value) in headers)
            {
                if (!name.Equals("content-type", StringComparison.OrdinalIgnoreCase))
                {
                    scenario.WithRequestHeader(name, value);
                }
            }
            // Url() sets the path and leaves the query where it found it, which for a scenario
            // built from a string is nowhere.
            if (query >= 0)
            {
                scenario.ConfigureHttpContext(
                    context => context.Request.QueryString = new QueryString(ask.Path[query..]));
            }
            scenario.IgnoreStatusCode();
        });

    /// <summary>Ask for the validator first, then send the request that carries it.</summary>
    public async Task<IScenarioResult> SendAfterCapture(Ask ask)
    {
        (string method, string path, string header) = Plan.CaptureFor(ask)
            ?? throw new InvalidOperationException($"{ask.Id} captures nothing");
        IScenarioResult first = await Host.Scenario(scenario =>
        {
            if (method == "GET") { scenario.Get.Url(path); }
            scenario.IgnoreStatusCode();
        });
        string captured = first.Context.Response.Headers[header].ToString();
        return await Send(ask, Plan.Resolved(ask, captured));
    }
}
