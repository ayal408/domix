using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace serverApi.Security
{
    /// <summary>
    /// Gates an endpoint to callers that present the shared INTERNAL_SERVICE_KEY via the
    /// X-Internal-Api-Key header. nginx already keeps these endpoints off the public
    /// internet (see nginx.conf's allow-list), but that's the gateway's job, not this
    /// service's — anything already on the Docker network (or reaching domix-server
    /// directly if the gateway config ever drifts) could otherwise call them freely, and
    /// several of them return full user records (email, phone, Google id) or let the
    /// caller create/link accounts.
    ///
    /// Pass allowAuthenticatedUser: true for an endpoint that both auth-server calls
    /// with no user token of its own (e.g. during refresh) and end users call directly
    /// with theirs (e.g. viewing another user's profile) — a request already carrying a
    /// valid Bearer JWT is let through without the internal key.
    /// </summary>
    public class InternalOnlyAttribute : Attribute, IAsyncActionFilter
    {
        private readonly bool _allowAuthenticatedUser;

        public InternalOnlyAttribute(bool allowAuthenticatedUser = false)
        {
            _allowAuthenticatedUser = allowAuthenticatedUser;
        }

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            if (_allowAuthenticatedUser && context.HttpContext.User.Identity?.IsAuthenticated == true)
            {
                await next();
                return;
            }

            var expectedKey = Environment.GetEnvironmentVariable("INTERNAL_SERVICE_KEY");
            var providedKey = context.HttpContext.Request.Headers["X-Internal-Api-Key"].ToString();

            if (string.IsNullOrEmpty(expectedKey) || !ConstantTimeEquals(providedKey, expectedKey))
            {
                context.Result = new ObjectResult(new { code = "FORBIDDEN" })
                {
                    StatusCode = StatusCodes.Status403Forbidden
                };
                return;
            }

            await next();
        }

        private static bool ConstantTimeEquals(string a, string b)
        {
            var bytesA = Encoding.UTF8.GetBytes(a);
            var bytesB = Encoding.UTF8.GetBytes(b);
            return bytesA.Length == bytesB.Length && CryptographicOperations.FixedTimeEquals(bytesA, bytesB);
        }
    }
}
