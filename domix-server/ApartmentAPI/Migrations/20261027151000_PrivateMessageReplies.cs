using Microsoft.EntityFrameworkCore.Migrations;
#nullable disable
namespace domix_server.ApartmentAPI.Migrations;
public partial class PrivateMessageReplies : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<bool>(name: "SenderIsAnonymous", table: "Messages", type: "boolean", nullable: false, defaultValue: false);
        migrationBuilder.AddColumn<bool>(name: "RecipientIsAnonymous", table: "Messages", type: "boolean", nullable: false, defaultValue: false);
        // Freeze privacy for existing listing contacts as well, including archived listings.
        migrationBuilder.Sql("""
            UPDATE "Messages" AS m SET
                "SenderIsAnonymous" = m."SenderId" = a."UserId",
                "RecipientIsAnonymous" = m."OwnerId" = a."UserId"
            FROM "Apartments" AS a
            WHERE m."ApartmentId" = a."ApartmentId" AND a."IsAnonymous";
            """);
    }
    protected override void Down(MigrationBuilder migrationBuilder) =>
        throw new NotSupportedException("Keep message anonymity snapshots. Do not roll back to code that reveals anonymous reply senders.");
}
