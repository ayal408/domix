using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using serverApi.Data;
using serverApi.Models;
using serverApi.Security;
using serverApi.Services;
using serverApi.Services.Implementations;
using serverApi.Services.Interfaces;
using System.Text;
using System.Threading.RateLimiting;

namespace serverApi.Extensions
{
    public static class ServiceCollectionExtensions
    {
        public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
        {
            // DotNetEnv.Env.Load() (called in Program.cs) populates these as real
            // process environment variables — read them directly rather than via
            // IConfiguration, since "DEFAULT_CONNECTION"/"JWT_SECRET" don't follow
            // the "Section__Key" shape ASP.NET Core's env-var provider expects.
            var connectionString = Environment.GetEnvironmentVariable("DEFAULT_CONNECTION")
                ?? configuration.GetConnectionString("DefaultConnection");

            if (string.IsNullOrWhiteSpace(connectionString))
                throw new InvalidOperationException("Configuration Error: DEFAULT_CONNECTION is not set.");

            services.AddDbContext<ApartmentContext>(options =>
                options.UseNpgsql(connectionString, opt =>
                {
                    opt.EnableRetryOnFailure(3);
                    opt.CommandTimeout(30);
                }));

            var jwtKey = Environment.GetEnvironmentVariable("JWT_SECRET");
            if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
                throw new InvalidOperationException("Configuration Error: JWT_SECRET must be set and at least 32 characters.");

            var jwtIssuer = configuration["Jwt:Issuer"] ?? "serverApi";
            var jwtAudience = configuration["Jwt:Audience"] ?? "serverApi";

            services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidateAudience = true,
                        ValidateLifetime = true,
                        ValidateIssuerSigningKey = true,
                        ValidIssuer = jwtIssuer,
                        ValidAudience = jwtAudience,
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
                        ClockSkew = TimeSpan.Zero
                    };

                    // The browser's WebSocket API can't set an Authorization header, so SignalR's
                    // JS client sends the token as a query param instead — accept it there, but only
                    // for the hub path (every other endpoint still requires a real Authorization header).
                    options.Events = new JwtBearerEvents
                    {
                        OnMessageReceived = context =>
                        {
                            var accessToken = context.Request.Query["access_token"];
                            var path = context.HttpContext.Request.Path;
                            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/api/hubs"))
                            {
                                context.Token = accessToken;
                            }
                            return Task.CompletedTask;
                        }
                    };
                });

            // Populates ClaimTypes.Role from the database on every request — the
            // access token itself never carries a role claim. See
            // RoleClaimsTransformation for why.
            services.AddScoped<IClaimsTransformation, RoleClaimsTransformation>();

            services.AddAuthorization(options =>
            {
                options.AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"));
                options.AddPolicy("ManagerOrAdmin", policy => policy.RequireRole("Manager", "Admin"));
            });

            // Permissive by design: the .NET API is called only via Bearer token
            // (never cookies), so it carries no CSRF exposure and does not need
            // AllowCredentials — see dataClient in the frontend's http.ts.
            services.AddCors(options =>
            {
                options.AddPolicy("AllowAll", policy =>
                    policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
            });

            // The chat endpoint is open to anonymous visitors and each request is a
            // real, billed Gemini API call — bound abuse/cost with a per-IP window
            // rather than relying on [Authorize].
            services.AddRateLimiter(options =>
            {
                options.AddPolicy("chat", httpContext => RateLimitPartition.GetFixedWindowLimiter(
                    partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    factory: _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 10,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 0
                    }));
                options.OnRejected = async (context, cancellationToken) =>
                {
                    context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                    await context.HttpContext.Response.WriteAsync(
                        "Too many chat requests. Please wait a moment and try again.", cancellationToken);
                };
            });

            return services;
        }

        public static IServiceCollection AddApplicationServices(this IServiceCollection services)
        {
            services.AddMemoryCache();
            services.AddSignalR();
            services.AddScoped<IImageService, ImageService>();
            services.AddSingleton<GoogleOAuthService>();
            services.AddScoped<IEmailService, EmailService>();

            services.AddHttpClient<IGeocodingService, NominatimGeocodingService>();
            services.AddHttpClient<IIsraeliAddressService, IsraeliAddressService>();
            services.AddScoped<IApartmentService, ApartmentService>();
            services.AddScoped<IApartmentImageService, ApartmentImageService>();
            services.AddScoped<IUserService, UserService>();
            services.AddScoped<IHealthService, HealthService>();
            services.AddScoped<IMessageService, MessageService>();
            services.AddScoped<IChatService, ChatService>();
            services.AddScoped<IFavoriteService, FavoriteService>();
            services.AddScoped<ISavedSearchService, SavedSearchService>();
            services.AddScoped<ISupportService, SupportService>();
            services.AddScoped<IAnalyticsService, AnalyticsService>();
            services.AddScoped<INotificationService, NotificationService>();
            services.AddHostedService<SavedSearchAlertBackgroundService>();
            return services;
        }

        public static IServiceCollection AddAppOptions(this IServiceCollection services, IConfiguration configuration)
        {
            services.Configure<GmailSettings>(configuration.GetSection("Gmail"));
            return services;
        }
    }
}
