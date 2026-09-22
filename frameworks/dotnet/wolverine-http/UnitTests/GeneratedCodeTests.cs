using JasperFx.CodeGeneration;
using JasperFx.CodeGeneration.Model;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace UnitTests;

/// <summary>
/// Holds the handlers under Implementation/Internal/Generated to what Wolverine generates from the
/// endpoints now. The Implementation loads them in TypeLoadMode.Static, which only checks that a
/// handler exists for each route, so a stale one would run without a change made to its endpoint.
/// It has a host of its own, because writing the code changes where the rules say it goes. It
/// runs in the shared host's collection, so no other host starts while JasperFx's static
/// WithinCodegenCommand flag is set.
/// </summary>
[Collection(nameof(WolverineApp))]
public sealed class GeneratedCodeTests : IAsyncLifetime
{
    private IAlbaHost host = null!;

    public async Task InitializeAsync()
    {
        Environment.SetEnvironmentVariable("RB_PAYLOADS", Expected.Directory);
        host = await AlbaHost.For<Program>(builder => builder.UseEnvironment(Environments.Production));
    }

    public async Task DisposeAsync() => await host.DisposeAsync();

    [Fact]
    public void The_committed_handlers_are_what_codegen_write_writes_now()
    {
        ICodeFileCollection[] collections = [.. host.Services.GetServices<ICodeFileCollection>()];
        string committed = collections.Select(c => c.Rules.GeneratedCodeOutputPath).Distinct().Single();
        DirectoryInfo fresh = Directory.CreateTempSubdirectory("wolverine-codegen-");
        try
        {
            foreach (ICodeFileCollection collection in collections)
            {
                collection.Rules.GeneratedCodeOutputPath = fresh.FullName;
            }
            new DynamicCodeBuilder(host.Services, collections) { ServiceVariableSource = host.Services.GetService<IServiceVariableSource>() }
                .WriteGeneratedCode(_ => { });

            Dictionary<string, string> want = Files(fresh.FullName);
            Dictionary<string, string> have = Files(committed);
            string[] stale = [.. want.Keys.Union(have.Keys).Where(f => want.GetValueOrDefault(f) != have.GetValueOrDefault(f)).Order()];
            Assert.True(stale.Length == 0,
                $"stale under {committed}: {string.Join(", ", stale)}. Delete the directory and run " +
                "`dotnet run -p:OpenApiGenerateDocuments=false -- codegen write` in Implementation/ with RB_PAYLOADS set.");
        }
        finally
        {
            fresh.Delete(recursive: true);
        }
    }

    private static Dictionary<string, string> Files(string root) =>
        Directory.GetFiles(root, "*.cs", SearchOption.AllDirectories).ToDictionary(f => Path.GetRelativePath(root, f), File.ReadAllText);
}
