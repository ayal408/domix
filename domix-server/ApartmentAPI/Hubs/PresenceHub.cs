using System.Collections.Concurrent;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace serverApi.Hubs
{
    /// <summary>
    /// Every signed-in client holds one connection open here for as long as its tab is open — that's
    /// what "active users right now" tracks. Only Admin/Manager connections join the broadcast group,
    /// so only the admin panel actually receives <c>ActiveUserCountChanged</c> events.
    /// </summary>
    [Authorize]
    public class PresenceHub : Hub
    {
        private const string AdminGroup = "presence-admins";

        // Connections-per-user, not just distinct user count: a user with two open tabs holds two
        // connections, and both must disconnect before they stop counting as active.
        private static readonly ConcurrentDictionary<Guid, int> ConnectionCounts = new();

        public override async Task OnConnectedAsync()
        {
            var userId = GetUserId();
            if (userId is Guid id)
            {
                ConnectionCounts.AddOrUpdate(id, 1, (_, count) => count + 1);
            }

            if (IsPrivileged())
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, AdminGroup);
            }

            await BroadcastActiveCountAsync();
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = GetUserId();
            if (userId is Guid id)
            {
                ConnectionCounts.AddOrUpdate(id, 0, (_, count) => Math.Max(0, count - 1));
                if (ConnectionCounts.TryGetValue(id, out var remaining) && remaining <= 0)
                {
                    ConnectionCounts.TryRemove(id, out _);
                }
            }

            await BroadcastActiveCountAsync();
            await base.OnDisconnectedAsync(exception);
        }

        /// <summary>Admin/Manager only — the current snapshot, for a page's initial render before the first broadcast arrives.</summary>
        public Task<int> GetActiveUserCount()
        {
            if (!IsPrivileged())
                throw new HubException("Forbidden");

            return Task.FromResult(ConnectionCounts.Count);
        }

        private Task BroadcastActiveCountAsync() =>
            Clients.Group(AdminGroup).SendAsync("ActiveUserCountChanged", ConnectionCounts.Count);

        private Guid? GetUserId()
        {
            var claim = Context.User?.FindFirst("userId")?.Value ?? Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(claim, out var id) ? id : null;
        }

        private bool IsPrivileged() => Context.User?.IsInRole("Admin") == true || Context.User?.IsInRole("Manager") == true;
    }
}
