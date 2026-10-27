using Microsoft.EntityFrameworkCore.Migrations;
#nullable disable
namespace domix_server.ApartmentAPI.Migrations;
public partial class ConversationWorkflows : Migration
{
    protected override void Up(MigrationBuilder m)
    {
        m.AddColumn<Guid>("ConversationId","Messages",type:"uuid",nullable:false,defaultValue:Guid.Empty);
        m.AddColumn<DateTime>("LastConfirmedAt","Apartments",type:"timestamp with time zone",nullable:true);
        m.AddColumn<DateTime>("RenewalSnoozedUntil","Apartments",type:"timestamp with time zone",nullable:true);
        m.Sql("""
            UPDATE "Messages" SET "ConversationId" = md5(least("SenderId"::text,"OwnerId"::text)||':'||greatest("SenderId"::text,"OwnerId"::text)||':'||coalesce("ApartmentId"::text,'00000000-0000-0000-0000-000000000000'))::uuid;
            ALTER TABLE "Apartments" DROP CONSTRAINT "CK_Apartments_Status";
            ALTER TABLE "Apartments" ADD CONSTRAINT "CK_Apartments_Status" CHECK ("IsDeleted" OR "Status" IN (0,1,2,3)) NOT VALID;
            """);
        m.CreateIndex("IX_Messages_ConversationId_CreatedAt_MessageId","Messages",new[]{"ConversationId","CreatedAt","MessageId"});
        m.CreateTable("UserBlocks",columns:t=>new{BlockerId=t.Column<Guid>(type:"uuid",nullable:false),BlockedId=t.Column<Guid>(type:"uuid",nullable:false),CreatedAt=t.Column<DateTime>(type:"timestamp with time zone",nullable:false)},constraints:t=>{
            t.PrimaryKey("PK_UserBlocks",x=>new{x.BlockerId,x.BlockedId});
            t.ForeignKey("FK_UserBlocks_Users_BlockerId",x=>x.BlockerId,"Users","UserId",onDelete:ReferentialAction.Restrict);
            t.ForeignKey("FK_UserBlocks_Users_BlockedId",x=>x.BlockedId,"Users","UserId",onDelete:ReferentialAction.Restrict);
        });
        m.CreateIndex("IX_UserBlocks_BlockedId","UserBlocks","BlockedId");
        m.CreateTable("ListingReports",columns:t=>new{Id=t.Column<Guid>(type:"uuid",nullable:false),ReporterId=t.Column<Guid>(type:"uuid",nullable:false),MessageId=t.Column<Guid>(type:"uuid",nullable:true),ApartmentId=t.Column<Guid>(type:"uuid",nullable:true),Reason=t.Column<string>(type:"character varying(40)",maxLength:40,nullable:false),Details=t.Column<string>(type:"character varying(1000)",maxLength:1000,nullable:false),CreatedAt=t.Column<DateTime>(type:"timestamp with time zone",nullable:false),ReviewedAt=t.Column<DateTime>(type:"timestamp with time zone",nullable:true),ReviewedBy=t.Column<Guid>(type:"uuid",nullable:true)},constraints:t=>{
            t.PrimaryKey("PK_ListingReports",x=>x.Id);t.ForeignKey("FK_ListingReports_Users_ReporterId",x=>x.ReporterId,"Users","UserId",onDelete:ReferentialAction.Restrict);
        });
        m.CreateIndex("IX_ListingReports_ReporterId","ListingReports","ReporterId");m.CreateIndex("IX_ListingReports_ReviewedAt_CreatedAt","ListingReports",new[]{"ReviewedAt","CreatedAt"});
        m.CreateTable("ConversationVisits",columns:t=>new{Id=t.Column<Guid>(type:"uuid",nullable:false),ConversationId=t.Column<Guid>(type:"uuid",nullable:false),ParticipantA=t.Column<Guid>(type:"uuid",nullable:false),ParticipantB=t.Column<Guid>(type:"uuid",nullable:false),ProposedBy=t.Column<Guid>(type:"uuid",nullable:false),StartsAt=t.Column<DateTime>(type:"timestamp with time zone",nullable:false),Status=t.Column<string>(type:"character varying(20)",maxLength:20,nullable:false),Revision=t.Column<Guid>(type:"uuid",nullable:false),UpdatedAt=t.Column<DateTime>(type:"timestamp with time zone",nullable:false)},constraints:t=>{
            t.PrimaryKey("PK_ConversationVisits",x=>x.Id);
            t.CheckConstraint("CK_ConversationVisits_Status","\"Status\" IN ('Pending','Accepted','Declined','Cancelled','Completed','Expired')");
            t.CheckConstraint("CK_ConversationVisits_Participants","\"ParticipantA\" <> \"ParticipantB\" AND \"ProposedBy\" IN (\"ParticipantA\",\"ParticipantB\")");
            t.ForeignKey("FK_ConversationVisits_Users_ParticipantA",x=>x.ParticipantA,"Users","UserId",onDelete:ReferentialAction.Restrict);
            t.ForeignKey("FK_ConversationVisits_Users_ParticipantB",x=>x.ParticipantB,"Users","UserId",onDelete:ReferentialAction.Restrict);
        });
        m.CreateIndex("IX_ConversationVisits_ParticipantA","ConversationVisits","ParticipantA");m.CreateIndex("IX_ConversationVisits_ParticipantB","ConversationVisits","ParticipantB");
        m.CreateIndex("IX_ConversationVisits_ConversationId_UpdatedAt","ConversationVisits",new[]{"ConversationId","UpdatedAt"});
        m.CreateIndex("IX_ConversationVisits_ConversationId","ConversationVisits","ConversationId",unique:true,filter:"\"Status\" IN ('Pending','Accepted')");
    }
    protected override void Down(MigrationBuilder m)=>throw new NotSupportedException("Preserve conversations, visit history, reports and blocks; roll forward without dropping data.");
}
