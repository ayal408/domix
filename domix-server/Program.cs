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
