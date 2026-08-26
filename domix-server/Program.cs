using FluentValidation.AspNetCore;
using Serilog;
using serverApi.Data;
using serverApi.Extensions;

DotNetEnv.Env.Load();

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File("logs/log-.txt", rollingInterval: RollingInterval.Day)
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog();

builder.Services.AddControllers();
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddApplicationServices();
builder.Services.AddAppOptions(builder.Configuration);

var app = builder.Build();

// No EF Core migrations exist yet in this project — this creates the schema
// from the current model on first boot against a fresh database. Replace
// with `dotnet ef migrations add InitialCreate` + `db.Database.Migrate()`
// once migrations are introduced; EnsureCreated and Migrate must not be mixed.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApartmentContext>();
    await db.Database.EnsureCreatedAsync();
}

app.ConfigurePipeline();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.MapControllers();

app.MapGet("/", async (ApartmentContext db) =>
{
    var canConnect = await db.Database.CanConnectAsync();
    return Results.Ok(new { status = canConnect ? "ok" : "db_error", time = DateTime.UtcNow });
});

app.Run();
