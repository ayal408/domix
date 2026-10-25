using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace domix_server.ApartmentAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddExchangeAgreementsAndHospitality : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "GuestCapacity",
                table: "Apartments",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "KitchenNotes",
                table: "Apartments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "KosherKitchen",
                table: "Apartments",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "SeparateBeds",
                table: "Apartments",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShabbatNotes",
                table: "Apartments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SynagogueDistanceMeters",
                table: "Apartments",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ExchangeAgreements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RequesterId = table.Column<Guid>(type: "uuid", nullable: false),
                    RecipientId = table.Column<Guid>(type: "uuid", nullable: false),
                    OfferedApartmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestedApartmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    OfferedHome = table.Column<string>(type: "text", nullable: false),
                    RequestedHome = table.Column<string>(type: "text", nullable: false),
                    Start = table.Column<DateOnly>(type: "date", nullable: false),
                    End = table.Column<DateOnly>(type: "date", nullable: false),
                    Guests = table.Column<int>(type: "integer", nullable: false),
                    RecipientGuests = table.Column<int>(type: "integer", nullable: true),
                    RequesterCompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RecipientCompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Note = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    ReplacesId = table.Column<Guid>(type: "uuid", nullable: true),
                    Revision = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExchangeAgreements", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ExchangeCalendarPeriods",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ApartmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    Start = table.Column<DateOnly>(type: "date", nullable: false),
                    End = table.Column<DateOnly>(type: "date", nullable: false),
                    IsAvailable = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExchangeCalendarPeriods", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ExchangeReviews",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AgreementId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewerId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewedUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Score = table.Column<int>(type: "integer", nullable: false),
                    Comment = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExchangeReviews", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ExchangeUserBlocks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    BlockedUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExchangeUserBlocks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ExchangeWatches",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    OfferedApartmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    Destination = table.Column<string>(type: "text", nullable: false),
                    Start = table.Column<DateOnly>(type: "date", nullable: false),
                    End = table.Column<DateOnly>(type: "date", nullable: false),
                    Guests = table.Column<int>(type: "integer", nullable: false),
                    KosherKitchen = table.Column<bool>(type: "boolean", nullable: false),
                    SeparateBeds = table.Column<bool>(type: "boolean", nullable: false),
                    MaxSynagogueDistance = table.Column<int>(type: "integer", nullable: true),
                    Frequency = table.Column<string>(type: "text", nullable: false),
                    SeenIds = table.Column<string>(type: "text", nullable: false),
                    Revision = table.Column<int>(type: "integer", nullable: false),
                    LeaseUntil = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastSentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExchangeWatches", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ExchangeAgreements_OfferedApartmentId_Start_End",
                table: "ExchangeAgreements",
                columns: new[] { "OfferedApartmentId", "Start", "End" });

            migrationBuilder.CreateIndex(
                name: "IX_ExchangeAgreements_RecipientId_Status",
                table: "ExchangeAgreements",
                columns: new[] { "RecipientId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ExchangeAgreements_RequestedApartmentId_Start_End",
                table: "ExchangeAgreements",
                columns: new[] { "RequestedApartmentId", "Start", "End" });

            migrationBuilder.CreateIndex(
                name: "IX_ExchangeAgreements_RequesterId_Status",
                table: "ExchangeAgreements",
                columns: new[] { "RequesterId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ExchangeCalendarPeriods_ApartmentId",
                table: "ExchangeCalendarPeriods",
                column: "ApartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_ExchangeReviews_AgreementId_ReviewerId",
                table: "ExchangeReviews",
                columns: new[] { "AgreementId", "ReviewerId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ExchangeUserBlocks_UserId_BlockedUserId",
                table: "ExchangeUserBlocks",
                columns: new[] { "UserId", "BlockedUserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ExchangeWatches_UserId_OfferedApartmentId_Destination_Start~",
                table: "ExchangeWatches",
                columns: new[] { "UserId", "OfferedApartmentId", "Destination", "Start", "End" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ExchangeAgreements");

            migrationBuilder.DropTable(
                name: "ExchangeCalendarPeriods");

            migrationBuilder.DropTable(
                name: "ExchangeReviews");

            migrationBuilder.DropTable(
                name: "ExchangeUserBlocks");

            migrationBuilder.DropTable(
                name: "ExchangeWatches");

            migrationBuilder.DropColumn(
                name: "GuestCapacity",
                table: "Apartments");

            migrationBuilder.DropColumn(
                name: "KitchenNotes",
                table: "Apartments");

            migrationBuilder.DropColumn(
                name: "KosherKitchen",
                table: "Apartments");

            migrationBuilder.DropColumn(
                name: "SeparateBeds",
                table: "Apartments");

            migrationBuilder.DropColumn(
                name: "ShabbatNotes",
                table: "Apartments");

            migrationBuilder.DropColumn(
                name: "SynagogueDistanceMeters",
                table: "Apartments");
        }
    }
}
