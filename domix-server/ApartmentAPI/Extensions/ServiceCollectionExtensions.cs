using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
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
            services.AddHttpContextAccessor();
            // DotNetEnv.Env.Load() (called in Program.cs) populates these as real
            // process environment variables — read them directly rather than via
            // IConfiguration, since "DEFAULT_CONNECTION"/"JWT_SECRET" don't follow
            // the "Section__Key" shape ASP.NET Core's env-var provider expects.
            var connectionString = ResolveConnectionString(
                Environment.GetEnvironmentVariable("DEFAULT_CONNECTION")
                ?? Environment.GetEnvironmentVariable("DATABASE_URL")
                ?? configuration.GetConnectionString("DefaultConnection"));

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

            // Read by InternalOnlyAttribute directly (same reasoning as JWT_SECRET above), but still
            // validated here so a missing/too-short key fails fast at startup instead of as a
            // confusing 403 the first time auth-server calls a gated endpoint.
            var internalServiceKey = Environment.GetEnvironmentVariable("INTERNAL_SERVICE_KEY");
            if (string.IsNullOrWhiteSpace(internalServiceKey) || internalServiceKey.Length < 32)
                throw new InvalidOperationException("Configuration Error: INTERNAL_SERVICE_KEY must be set and at least 32 characters.");

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
                        OnTokenValidated = async context =>
                        {
                            var id = context.Principal?.FindFirst("userId")?.Value
                                ?? context.Principal?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                            var db = context.HttpContext.RequestServices.GetRequiredService<ApartmentContext>();
                            if (!Guid.TryParse(id, out var userId) || !await db.Users.AnyAsync(u => u.UserId == userId && !u.IsBlocked, context.HttpContext.RequestAborted))
                                context.Fail("Account is not active.");
                        },
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

                // Upload has a per-file size cap (see ApartmentImageService) but nothing stopped a
                // single authenticated user from calling it back-to-back -- partition by userId
                // (not IP) since it's always [Authorize]d and a shared IP (office NAT) shouldn't
                // throttle multiple real users together.
                options.AddPolicy("imageUpload", httpContext => RateLimitPartition.GetFixedWindowLimiter(
                    partitionKey: httpContext.User.FindFirst("userId")?.Value
                        ?? httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                        ?? httpContext.Connection.RemoteIpAddress?.ToString()
                        ?? "unknown",
                    factory: _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 20,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 0
                    }));

                options.OnRejected = async (context, cancellationToken) =>
                {
                    context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                    await context.HttpContext.Response.WriteAsync(
                        "Too many requests. Please wait a moment and try again.", cancellationToken);
                };
            });

            return services;
        }

        private static string? ResolveConnectionString(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return value;

            if (!Uri.TryCreate(value, UriKind.Absolute, out var uri)
                || (uri.Scheme != "postgres" && uri.Scheme != "postgresql"))
            {
                return value;
            }

            var credentials = uri.UserInfo.Split(':', 2);
            var builder = new NpgsqlConnectionStringBuilder
            {
                Host = uri.Host,
                Port = uri.IsDefaultPort ? 5432 : uri.Port,
                Database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/')),
                Username = credentials.Length > 0 ? Uri.UnescapeDataString(credentials[0]) : string.Empty,
                Password = credentials.Length > 1 ? Uri.UnescapeDataString(credentials[1]) : string.Empty
            };

            foreach (var pair in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
            {
                var parts = pair.Split('=', 2);
                if (parts.Length == 2
                    && Uri.UnescapeDataString(parts[0]).Equals("sslmode", StringComparison.OrdinalIgnoreCase)
                    && Enum.TryParse<SslMode>(Uri.UnescapeDataString(parts[1]), true, out var sslMode))
                {
                    builder.SslMode = sslMode;
                }
            }

            return builder.ConnectionString;
        }

        public static IServiceCollection AddApplicationServices(this IServiceCollection services)
        {
            services.AddMemoryCache();
            services.AddSignalR();
            services.AddScoped<IImageService, ImageService>();
            services.AddSingleton<GoogleOAuthService>();
            services.AddSingleton(new GmailTokenProtector(Environment.GetEnvironmentVariable("JWT_SECRET")!));
            services.AddScoped<GmailConnectionService>();
            services.AddSingleton<OutlookConnectionService>();
            services.AddSingleton<ActivityTracker>();
            services.AddScoped<EmailConfigurationService>();
            services.AddScoped<IEmailService, EmailService>();

            services.AddHttpClient("GoogleOAuth", client => client.Timeout = TimeSpan.FromSeconds(8));
            services.AddHttpClient("OutlookMail", client => client.Timeout = TimeSpan.FromSeconds(10));
            services.AddHttpClient("GmailConsent", client => client.Timeout = TimeSpan.FromSeconds(10));
            services.AddHttpClient<IGeocodingService, NominatimGeocodingService>(client => client.Timeout = TimeSpan.FromSeconds(8));
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
            services.AddScoped<IRefreshTokenService, RefreshTokenService>();
            services.AddScoped<PrivacyMaintenance>();
            services.AddHostedService<PrivacyMaintenanceBackgroundService>();
            services.AddScoped<SavedSearchEmailDispatcher>();
            services.AddHostedService<SavedSearchAlertBackgroundService>();
            services.AddHostedService<RefreshTokenCleanupBackgroundService>();
            return services;
        }

        public static IServiceCollection AddAppOptions(this IServiceCollection services, IConfiguration configuration)
        {
            services.Configure<GmailSettings>(configuration.GetSection("Gmail"));
            return services;
        }
    }
}
