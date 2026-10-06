using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
namespace domix_server.ApartmentAPI.Migrations;

public partial class AddEmailLanguage : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) =>
        migrationBuilder.AddColumn<string>(name: "LanguagePreference", table: "Users", type: "text", nullable: false, defaultValue: "he");
    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.DropColumn(name: "LanguagePreference", table: "Users");
}
