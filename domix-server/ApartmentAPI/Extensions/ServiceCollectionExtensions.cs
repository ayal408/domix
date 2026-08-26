using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using serverApi.Data;
using serverApi.Models;
using serverApi.Security;
using serverApi.Services;
using serverApi.Services.Implementations;
using serverApi.Services.Interfaces;
using System.Text;

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

            return services;
        }

        public static IServiceCollection AddApplicationServices(this IServiceCollection services)
        {
            services.AddScoped<IImageService, ImageService>();
            services.AddSingleton<GoogleOAuthService>();
            services.AddScoped<IEmailService, EmailService>();

            services.AddHttpClient<IGeocodingService, NominatimGeocodingService>();
            services.AddScoped<IApartmentService, ApartmentService>();
            services.AddScoped<IApartmentImageService, ApartmentImageService>();
            services.AddScoped<IUserService, UserService>();
            services.AddScoped<IHealthService, HealthService>();
            services.AddScoped<IMessageService, MessageService>();
            services.AddScoped<IFavoriteService, FavoriteService>();
            services.AddScoped<ISavedSearchService, SavedSearchService>();
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
