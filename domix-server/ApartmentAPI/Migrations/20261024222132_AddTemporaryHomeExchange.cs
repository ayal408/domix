using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace domix_server.ApartmentAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddTemporaryHomeExchange : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(
                name: "MinRooms",
                table: "SavedSearches",
                type: "numeric",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "MaxRooms",
                table: "SavedSearches",
                type: "numeric",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ListingType",
                table: "SavedSearches",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ApartmentId",
                table: "Messages",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "ExchangeEnd",
                table: "Messages",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "ExchangeStart",
                table: "Messages",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OfferedApartmentId",
                table: "Messages",
                type: "uuid",
                nullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "SumOfRooms",
                table: "Apartments",
                type: "numeric",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "AvailableFrom",
                table: "Apartments",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "AvailableTo",
                table: "Apartments",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DesiredCity",
                table: "Apartments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ListingType",
                table: "Apartments",
                type: "text",
                nullable: false,
                defaultValue: "Unspecified");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ListingType",
                table: "SavedSearches");

            migrationBuilder.DropColumn(
                name: "ApartmentId",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "ExchangeEnd",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "ExchangeStart",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "OfferedApartmentId",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "AvailableFrom",
                table: "Apartments");

            migrationBuilder.DropColumn(
                name: "AvailableTo",
                table: "Apartments");

            migrationBuilder.DropColumn(
                name: "DesiredCity",
                table: "Apartments");

            migrationBuilder.DropColumn(
                name: "ListingType",
                table: "Apartments");

            migrationBuilder.AlterColumn<int>(
                name: "MinRooms",
                table: "SavedSearches",
                type: "integer",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "MaxRooms",
                table: "SavedSearches",
                type: "integer",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "SumOfRooms",
                table: "Apartments",
                type: "integer",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric",
                oldNullable: true);
        }
    }
}
