using Microsoft.AspNetCore.Builder;
using serverApi.Middleware;

namespace serverApi.Extensions
{
    public static class ApplicationBuilderExtensions
    {
        public static IApplicationBuilder ConfigurePipeline(this IApplicationBuilder app)
        {
            // Serves ApartmentImageService's uploads from wwwroot/images/{file} at /images/{file} —
            // without this, every uploaded photo 404s regardless of the nginx routing fix alongside it.
            app.UseStaticFiles();

            app.UseRouting();
            
            app.UseCors("AllowAll");

            app.UseMiddleware<CorrelationIdMiddleware>();

            app.UseAuthentication();
            app.UseAuthorization();

            app.UseRateLimiter();
            
            return app;
        }
    }
}