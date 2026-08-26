using Microsoft.AspNetCore.Http;
using Serilog.Context;

namespace serverApi.Middleware
{
    public class CorrelationIdMiddleware
    {
        private readonly RequestDelegate _next;
        public const string HeaderName = "X-Correlation-ID";

        public CorrelationIdMiddleware(RequestDelegate next)
        {
            _next = next ?? throw new ArgumentNullException(nameof(next));
        }

        public async Task Invoke(HttpContext context)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));

            string correlationId;

            if (context.Request.Headers.TryGetValue(HeaderName, out var existingHeaderValue) && !string.IsNullOrWhiteSpace(existingHeaderValue))
            {
                correlationId = existingHeaderValue!;
            }
            else
            {
                correlationId = Guid.NewGuid().ToString();
            }

            context.Items[HeaderName] = correlationId;
            context.Response.Headers[HeaderName] = correlationId;

            // הזרקת ה-CorrelationId ל-Serilog LogContext לצורך מעקב רוחבי
            using (LogContext.PushProperty("CorrelationId", correlationId))
            {
                await _next(context);
            }
        }
    }
}