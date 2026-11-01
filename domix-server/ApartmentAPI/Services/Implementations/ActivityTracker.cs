using System.Collections.Concurrent;

namespace serverApi.Services.Implementations;

/// <summary>Tracks recently active users without requiring a persistent WebSocket.</summary>
public sealed class ActivityTracker
{
    private static readonly TimeSpan ActiveWindow = TimeSpan.FromSeconds(75);
    private readonly ConcurrentDictionary<Guid, DateTime> _lastSeen = new();

    public int Touch(Guid userId)
    {
        var now = DateTime.UtcNow;
        _lastSeen[userId] = now;
        var staleBefore = now - ActiveWindow;
        foreach (var entry in _lastSeen)
            if (entry.Value < staleBefore) _lastSeen.TryRemove(entry.Key, out _);
        return _lastSeen.Count;
    }
}
