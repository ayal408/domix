using System.Text.Json.Serialization;
using FluentValidation.AspNetCore;
using Microsoft.EntityFrameworkCore;
using Serilog;
using serverApi.Data;
using serverApi.Extensions;
using serverApi.Hubs;

DotNetEnv.Env.Load();

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File("logs/log-.txt", rollingInterval: RollingInterval.Day)
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog();

// Common convention for PaaS hosts (Render, Heroku, ...), and what docker-compose.yml /
// .env.example already document as configurable -- without this, PORT was silently ignored and
// Kestrel just fell back to whatever ASPNETCORE_URLS/launchSettings said, which only happened to
// line up with the container's actual exposed port by coincidence (the official aspnet image
// defaults ASPNETCORE_HTTP_PORTS to 8080). ASPNETCORE_URLS, if set, still wins.
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(port) && string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("ASPNETCORE_URLS")))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

builder.Services.AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddApplicationServices();
builder.Services.AddAppOptions(builder.Configuration);

var app = builder.Build();

// Applies any pending EF Core migrations on boot, including the very first one against an empty
// database. EnsureCreated is never used alongside this — the two are mutually exclusive since
// EnsureCreated bypasses the migrations history table entirely.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApartmentContext>();
    await db.Database.MigrateAsync();
}

app.ConfigurePipeline();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.MapControllers();
app.MapHub<PresenceHub>("/api/hubs/presence");

// Kept for backward compatibility (existing uptime checks, docker-compose healthcheck) --
// equivalent to /healthz/ready below.
app.MapGet("/", async (ApartmentContext db) =>
{
    var canConnect = await db.Database.CanConnectAsync();
    return Results.Ok(new { status = canConnect ? "ok" : "db_error", time = DateTime.UtcNow });
});

// Liveness: is the process itself responsive? No DB call -- an orchestrator (k8s, ECS, ...)
// should restart the container on a liveness failure, and a slow/down database is not a reason
// to restart a perfectly healthy process (it would just restart in a loop instead of recovering).
app.MapGet("/healthz/live", () => Results.Ok(new { status = "ok" }));

// Readiness: can this instance actually serve traffic right now? An orchestrator should stop
// routing to it on failure here, but must NOT restart it -- the database recovering is exactly
// what should flip this back to ready without a restart.
app.MapGet("/healthz/ready", async (ApartmentContext db) =>
{
    var canConnect = await db.Database.CanConnectAsync();
    return canConnect
        ? Results.Ok(new { status = "ok" })
        : Results.Json(new { status = "db_unreachable" }, statusCode: StatusCodes.Status503ServiceUnavailable);
});

app.Run();
