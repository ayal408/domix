using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
namespace domix_server.ApartmentAPI.Migrations;

public partial class AddSystemEmailSettings : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "SystemEmailSettings",
            columns: table => new
            {
                Id = table.Column<int>(type: "integer", nullable: false),
                SenderName = table.Column<string>(type: "text", nullable: false),
                Email = table.Column<string>(type: "text", nullable: false),
                ReplyTo = table.Column<string>(type: "text", nullable: false),
                Signature = table.Column<string>(type: "text", nullable: false),
                TestSubject = table.Column<string>(type: "text", nullable: false),
                TestBody = table.Column<string>(type: "text", nullable: false),
                ProtectedRefreshToken = table.Column<string>(type: "text", nullable: true),
                Enabled = table.Column<bool>(type: "boolean", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_SystemEmailSettings", x => x.Id));
        migrationBuilder.CreateTable(
            name: "EmailDeliveries",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                Recipient = table.Column<string>(type: "text", nullable: false),
                Subject = table.Column<string>(type: "text", nullable: false),
                Succeeded = table.Column<bool>(type: "boolean", nullable: false),
                FailureCode = table.Column<string>(type: "text", nullable: true),
                CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_EmailDeliveries", x => x.Id));
        migrationBuilder.CreateIndex("IX_EmailDeliveries_CreatedAt", "EmailDeliveries", "CreatedAt");
    }
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable("EmailDeliveries");
        migrationBuilder.DropTable("SystemEmailSettings");
    }
}
