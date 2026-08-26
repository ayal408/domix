using Microsoft.AspNetCore.Builder;
using serverApi.Middleware;

namespace serverApi.Extensions
{
    public static class ApplicationBuilderExtensions
    {
        public static IApplicationBuilder ConfigurePipeline(this IApplicationBuilder app)
        {
            app.UseRouting();
            
            app.UseCors("AllowAll");
            
            app.UseMiddleware<CorrelationIdMiddleware>();
            
            app.UseAuthentication();
            app.UseAuthorization();
            
            return app;
        }
    }
}