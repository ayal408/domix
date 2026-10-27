using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace domix_server.ApartmentAPI.Migrations
{
    /// <inheritdoc />
    public partial class MailProvidersAndNotificationDismissal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "NotificationsDismissedAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Provider",
                table: "SystemEmailSettings",
                type: "text",
                nullable: false,
                defaultValue: "gmail");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            throw new NotSupportedException("Keep the additive schema. Disconnect Outlook and restore Gmail before rolling back application code.");
        }
    }
}
