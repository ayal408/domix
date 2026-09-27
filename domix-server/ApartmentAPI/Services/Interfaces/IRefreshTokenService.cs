namespace serverApi.Services.Interfaces
{
    /// <summary>
    /// Tracks revoked refresh tokens by their `jti` claim. The refresh token itself is a
    /// self-contained JWT signed by auth-server and never seen here -- this is a denylist, not a
    /// token store, so a row's mere existence means "revoked" (nothing is ever read back except
    /// membership).
    /// </summary>
    public interface IRefreshTokenService
    {
        Task RevokeAsync(Guid userId, string jti, DateTime expires, CancellationToken cancellationToken = default);
        Task<bool> IsRevokedAsync(string jti, CancellationToken cancellationToken = default);

        /// <summary>
        /// Deletes revoked-token rows whose underlying refresh token has already expired on its
        /// own -- once that happens the row is dead weight, since an expired JWT is rejected by
        /// signature/expiry verification alone regardless of what this table says.
        /// </summary>
        Task<int> PurgeExpiredAsync(CancellationToken cancellationToken = default);
    }
}
