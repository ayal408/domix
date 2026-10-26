using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace domix_server.ApartmentAPI.Migrations
{
    /// <inheritdoc />
    public partial class DatabaseIntegrity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Never merge or delete identities automatically. A collision aborts the transaction unchanged.
            migrationBuilder.Sql(@"DO $$ BEGIN
                IF EXISTS (SELECT 1 FROM ""Users"" WHERE NULLIF(lower(trim(""EmailAddress"")), '') IS NOT NULL
                    GROUP BY lower(trim(""EmailAddress"")) HAVING count(*) > 1)
                THEN RAISE EXCEPTION 'DATABASE_INTEGRITY_EMAIL_COLLISIONS: run the read-only preflight and resolve account ownership before upgrading';
                END IF;
            END $$;");
            migrationBuilder.DropForeignKey(
                name: "FK_Apartments_Users_UserId",
                table: "Apartments");

            migrationBuilder.DropForeignKey(
                name: "FK_Appointments_Apartments_ApartmentId",
                table: "Appointments");

            migrationBuilder.DropForeignKey(
                name: "FK_ClosingDeals_Apartments_ApartmentId",
                table: "ClosingDeals");

            migrationBuilder.DropForeignKey(
                name: "FK_Messages_Users_OwnerId",
                table: "Messages");

            migrationBuilder.DropForeignKey(
                name: "FK_Messages_Users_SenderId",
                table: "Messages");

            migrationBuilder.DropIndex(
                name: "IX_Messages_OwnerId",
                table: "Messages");

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ApartmentSnapshot",
                table: "Messages",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OfferedApartmentSnapshot",
                table: "Messages",
                type: "text",
                nullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "price",
                table: "Apartments",
                type: "numeric(14,2)",
                precision: 14,
                scale: 2,
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "Apartments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "Apartments",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<long>(
                name: "RatingSum",
                table: "Apartments",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<int>(
                name: "RecordedRatingCount",
                table: "Apartments",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "NormalizedEmail",
                table: "Users",
                type: "text",
                nullable: true,
                computedColumnSql: "NULLIF(lower(trim(\"EmailAddress\")), '')",
                stored: true);

            migrationBuilder.AddColumn<string>(
                name: "NormalizedCity",
                table: "Apartments",
                type: "text",
                nullable: false,
                computedColumnSql: "lower(trim(city))",
                stored: true);

            migrationBuilder.CreateTable(
                name: "ApartmentRatings",
                columns: table => new
                {
                    ApartmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Score = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ApartmentRatings", x => new { x.ApartmentId, x.UserId });
                    table.CheckConstraint("CK_ApartmentRatings_Score", "\"Score\" BETWEEN 1 AND 5");
                    table.ForeignKey(
                        name: "FK_ApartmentRatings_Apartments_ApartmentId",
                        column: x => x.ApartmentId,
                        principalTable: "Apartments",
                        principalColumn: "ApartmentId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ApartmentRatings_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Users_NormalizedEmail",
                table: "Users",
                column: "NormalizedEmail",
                unique: true);

            migrationBuilder.Sql(@"ALTER TABLE ""Users"" ADD CONSTRAINT ""CK_Users_Role"" CHECK (""Role"" IN ('User','Manager','Admin')) NOT VALID;");

            migrationBuilder.Sql(@"ALTER TABLE ""SavedSearches"" ADD CONSTRAINT ""CK_SavedSearches_Ranges"" CHECK ((""MinPrice"" IS NULL OR ""MinPrice"" >= 0) AND (""MaxPrice"" IS NULL OR ""MaxPrice"" >= 0) AND (""MinPrice"" IS NULL OR ""MaxPrice"" IS NULL OR ""MinPrice"" <= ""MaxPrice"") AND (""MinRooms"" IS NULL OR ""MinRooms"" >= 0) AND (""MaxRooms"" IS NULL OR ""MaxRooms"" >= 0) AND (""MinRooms"" IS NULL OR ""MaxRooms"" IS NULL OR ""MinRooms"" <= ""MaxRooms"")) NOT VALID;");

            migrationBuilder.Sql(@"ALTER TABLE ""SavedSearchEmails"" ADD CONSTRAINT ""CK_SavedSearchEmails_Status"" CHECK (""Status"" IN ('Pending','Sending','Sent','Blocked','Unknown','Cancelled')) NOT VALID;");

            migrationBuilder.CreateIndex(
                name: "IX_Messages_ApartmentId",
                table: "Messages",
                column: "ApartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_Messages_OfferedApartmentId",
                table: "Messages",
                column: "OfferedApartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_Messages_OwnerId_IsArchived_CreatedAt_MessageId",
                table: "Messages",
                columns: new[] { "OwnerId", "IsArchived", "CreatedAt", "MessageId" },
                descending: new[] { false, false, true, true },
                filter: "NOT \"IsDeleted\"");

            migrationBuilder.Sql(@"ALTER TABLE ""Messages"" ADD CONSTRAINT ""CK_Messages_Exchange"" CHECK ((""OfferedApartmentId"" IS NULL AND ""ExchangeStart"" IS NULL AND ""ExchangeEnd"" IS NULL) OR (""OfferedApartmentId"" IS NOT NULL AND ""ApartmentId"" IS NOT NULL AND ""ExchangeStart"" IS NOT NULL AND ""ExchangeEnd"" IS NOT NULL AND ""ExchangeEnd"" > ""ExchangeStart"" AND ""SenderId"" <> ""OwnerId"")) NOT VALID;");

            migrationBuilder.CreateIndex(
                name: "IX_ClosingDeals_idUserBuyer",
                table: "ClosingDeals",
                column: "idUserBuyer");

            migrationBuilder.CreateIndex(
                name: "IX_ClosingDeals_idUserManager",
                table: "ClosingDeals",
                column: "idUserManager");

            migrationBuilder.CreateIndex(
                name: "IX_Apartments_dateInsert_ApartmentId",
                table: "Apartments",
                columns: new[] { "dateInsert", "ApartmentId" },
                descending: new[] { true, false },
                filter: "\"Status\" = 0 AND NOT \"IsDeleted\"");

            migrationBuilder.CreateIndex(
                name: "IX_Apartments_NormalizedCity_ListingType_AvailableFrom_Availab~",
                table: "Apartments",
                columns: new[] { "NormalizedCity", "ListingType", "AvailableFrom", "AvailableTo" });

            migrationBuilder.Sql(@"ALTER TABLE ""Apartments"" ADD CONSTRAINT ""CK_Apartments_Address"" CHECK (""IsDeleted"" OR (trim(city) <> '' AND trim(address) <> '' AND trim(area) <> '')) NOT VALID;");

            migrationBuilder.Sql(@"ALTER TABLE ""Apartments"" ADD CONSTRAINT ""CK_Apartments_Dimensions"" CHECK (""IsDeleted"" OR ((""SumOfRooms"" IS NULL OR ""SumOfRooms"" > 0) AND (""SquareMeters"" IS NULL OR ""SquareMeters"" > 0) AND (""SumOfBeds"" IS NULL OR ""SumOfBeds"" >= 0))) NOT VALID;");

            migrationBuilder.Sql(@"ALTER TABLE ""Apartments"" ADD CONSTRAINT ""CK_Apartments_ExchangeDates"" CHECK (""IsDeleted"" OR (""ListingType"" <> 'Exchange' OR (""AvailableFrom"" IS NOT NULL AND ""AvailableTo"" IS NOT NULL AND ""AvailableTo"" > ""AvailableFrom"" AND ""DesiredCity"" IS NOT NULL AND trim(""DesiredCity"") <> ''))) NOT VALID;");

            migrationBuilder.Sql(@"ALTER TABLE ""Apartments"" ADD CONSTRAINT ""CK_Apartments_ListingType"" CHECK (""IsDeleted"" OR (""ListingType"" IN ('Unspecified','Exchange','Rent','Sale'))) NOT VALID;");

            migrationBuilder.Sql(@"ALTER TABLE ""Apartments"" ADD CONSTRAINT ""CK_Apartments_Price"" CHECK (""IsDeleted"" OR (price >= 0 AND (""ListingType"" = 'Exchange' OR price > 0))) NOT VALID;");

            migrationBuilder.Sql(@"ALTER TABLE ""Apartments"" ADD CONSTRAINT ""CK_Apartments_RecordedRating"" CHECK (""RecordedRatingCount"" >= 0 AND ""RatingSum"" >= ""RecordedRatingCount"" AND ""RatingSum"" <= 5 * CAST(""RecordedRatingCount"" AS bigint)) NOT VALID;");

            migrationBuilder.Sql(@"ALTER TABLE ""Apartments"" ADD CONSTRAINT ""CK_Apartments_Status"" CHECK (""IsDeleted"" OR (""Status"" IN (0,1,2))) NOT VALID;");

            migrationBuilder.CreateIndex(
                name: "IX_ApartmentRatings_UserId",
                table: "ApartmentRatings",
                column: "UserId");

            migrationBuilder.Sql(@"ALTER TABLE ""Apartments"" ADD CONSTRAINT ""FK_Apartments_Users_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""UserId"") ON DELETE RESTRICT NOT VALID;");

            migrationBuilder.Sql(@"ALTER TABLE ""Appointments"" ADD CONSTRAINT ""FK_Appointments_Apartments_ApartmentId"" FOREIGN KEY (""ApartmentId"") REFERENCES ""Apartments"" (""ApartmentId"") ON DELETE RESTRICT NOT VALID;");

            migrationBuilder.Sql(@"ALTER TABLE ""ClosingDeals"" ADD CONSTRAINT ""FK_ClosingDeals_Apartments_ApartmentId"" FOREIGN KEY (""ApartmentId"") REFERENCES ""Apartments"" (""ApartmentId"") ON DELETE RESTRICT NOT VALID;");

            migrationBuilder.Sql(@"ALTER TABLE ""ClosingDeals"" ADD CONSTRAINT ""FK_ClosingDeals_Users_idUserBuyer"" FOREIGN KEY (""idUserBuyer"") REFERENCES ""Users"" (""UserId"") ON DELETE RESTRICT NOT VALID;");

            migrationBuilder.Sql(@"ALTER TABLE ""ClosingDeals"" ADD CONSTRAINT ""FK_ClosingDeals_Users_idUserManager"" FOREIGN KEY (""idUserManager"") REFERENCES ""Users"" (""UserId"") ON DELETE RESTRICT NOT VALID;");

            migrationBuilder.Sql(@"ALTER TABLE ""Messages"" ADD CONSTRAINT ""FK_Messages_Apartments_ApartmentId"" FOREIGN KEY (""ApartmentId"") REFERENCES ""Apartments"" (""ApartmentId"") ON DELETE RESTRICT NOT VALID;");

            migrationBuilder.Sql(@"ALTER TABLE ""Messages"" ADD CONSTRAINT ""FK_Messages_Apartments_OfferedApartmentId"" FOREIGN KEY (""OfferedApartmentId"") REFERENCES ""Apartments"" (""ApartmentId"") ON DELETE RESTRICT NOT VALID;");

            migrationBuilder.Sql(@"ALTER TABLE ""Messages"" ADD CONSTRAINT ""FK_Messages_Users_OwnerId"" FOREIGN KEY (""OwnerId"") REFERENCES ""Users"" (""UserId"") ON DELETE RESTRICT NOT VALID;");

            migrationBuilder.Sql(@"ALTER TABLE ""Messages"" ADD CONSTRAINT ""FK_Messages_Users_SenderId"" FOREIGN KEY (""SenderId"") REFERENCES ""Users"" (""UserId"") ON DELETE RESTRICT NOT VALID;");
            migrationBuilder.Sql(@"UPDATE ""Messages"" m SET ""ApartmentSnapshot"" = a.city || ', ' || a.address
                FROM ""Apartments"" a WHERE m.""ApartmentId"" = a.""ApartmentId"" AND m.""ApartmentSnapshot"" IS NULL;");
            migrationBuilder.Sql(@"UPDATE ""Messages"" m SET ""OfferedApartmentSnapshot"" = a.city || ', ' || a.address
                FROM ""Apartments"" a WHERE m.""OfferedApartmentId"" = a.""ApartmentId"" AND m.""OfferedApartmentSnapshot"" IS NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            throw new NotSupportedException("This migration preserves history and exact prices. Restore a verified backup or apply a reviewed forward migration; automatic destructive downgrade is disabled.");
        }
    }
}
