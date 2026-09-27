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

app.MapGet("/", async (ApartmentContext db) =>
{
    var canConnect = await db.Database.CanConnectAsync();
    return Results.Ok(new { status = canConnect ? "ok" : "db_error", time = DateTime.UtcNow });
});

app.Run();
