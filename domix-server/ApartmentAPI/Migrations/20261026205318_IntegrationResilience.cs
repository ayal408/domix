using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace domix_server.ApartmentAPI.Migrations
{
    /// <inheritdoc />
    public partial class IntegrationResilience : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ConnectionStatus",
                table: "SystemEmailSettings",
                type: "text",
                nullable: false,
                defaultValue: "configured");

            migrationBuilder.AddColumn<DateTime>(
                name: "LastCheckedAt",
                table: "SystemEmailSettings",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "SavedSearchEmails",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SavedSearchId = table.Column<Guid>(type: "uuid", nullable: false),
                    FromAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ThroughAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Recipient = table.Column<string>(type: "text", nullable: false),
                    Subject = table.Column<string>(type: "text", nullable: false),
                    HtmlBody = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AttemptedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FailureCode = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SavedSearchEmails", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SavedSearchEmails_SavedSearches_SavedSearchId",
                        column: x => x.SavedSearchId,
                        principalTable: "SavedSearches",
                        principalColumn: "SavedSearchId",
                        onDelete: ReferentialAction.Cascade);
                });

            // Historical check-then-insert revocations could have produced duplicates.
            // Keep the longest retention so an unexpired token never becomes usable again.
            migrationBuilder.Sql(@"DELETE FROM ""RefreshTokens"" a USING ""RefreshTokens"" b
                WHERE a.""Token"" = b.""Token"" AND
                (a.""Expires"" < b.""Expires"" OR (a.""Expires"" = b.""Expires"" AND a.""Id"" < b.""Id""));");
            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_Token",
                table: "RefreshTokens",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SavedSearchEmails_SavedSearchId_FromAt",
                table: "SavedSearchEmails",
                columns: new[] { "SavedSearchId", "FromAt" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SavedSearchEmails_Status_CreatedAt",
                table: "SavedSearchEmails",
                columns: new[] { "Status", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SavedSearchEmails");

            migrationBuilder.DropIndex(
                name: "IX_RefreshTokens_Token",
                table: "RefreshTokens");

            migrationBuilder.DropColumn(
                name: "ConnectionStatus",
                table: "SystemEmailSettings");

            migrationBuilder.DropColumn(
                name: "LastCheckedAt",
                table: "SystemEmailSettings");
        }
    }
}
