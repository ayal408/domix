using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using serverApi.Data;

#nullable disable

namespace domix_server.ApartmentAPI.Migrations;

[DbContext(typeof(ApartmentContext))]
[Migration("20261101194500_AddGoogleOAuthCredentials")]
public partial class AddGoogleOAuthCredentials : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "GoogleClientId",
            table: "SystemEmailSettings",
            type: "text",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "ProtectedGoogleClientSecret",
            table: "SystemEmailSettings",
            type: "text",
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "GoogleClientId", table: "SystemEmailSettings");
        migrationBuilder.DropColumn(name: "ProtectedGoogleClientSecret", table: "SystemEmailSettings");
    }
}
