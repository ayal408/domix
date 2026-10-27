using Microsoft.EntityFrameworkCore.Migrations;
#nullable disable
namespace domix_server.ApartmentAPI.Migrations;
public partial class ReturnJourneys:Migration
{
    protected override void Up(MigrationBuilder m)
    {
        m.AddColumn<Guid>("ClientDraftId","Apartments",type:"uuid",nullable:true);
        m.CreateIndex("IX_Apartments_UserId_ClientDraftId","Apartments",new[]{"UserId","ClientDraftId"},unique:true,filter:"\"ClientDraftId\" IS NOT NULL");
        m.AddColumn<string>("AlertChannel","SavedSearches",type:"character varying(20)",maxLength:20,nullable:false,defaultValue:"Both");
        m.AddCheckConstraint("CK_SavedSearches_AlertChannel","SavedSearches","\"AlertChannel\" IN ('Site','Email','Both','Off')");
        m.AddColumn<int>("MatchCount","SavedSearchEmails",type:"integer",nullable:false,defaultValue:0);
        m.AddColumn<bool>("SiteVisible","SavedSearchEmails",type:"boolean",nullable:false,defaultValue:true);
        m.AddColumn<DateTime>("SeenAt","SavedSearchEmails",type:"timestamp with time zone",nullable:true);
        m.AddColumn<Guid>("ReminderDismissedARevision","ConversationVisits",type:"uuid",nullable:true);
        m.AddColumn<Guid>("ReminderDismissedBRevision","ConversationVisits",type:"uuid",nullable:true);
        m.CreateTable("ConversationLeads",columns:t=>new{ConversationId=t.Column<Guid>(type:"uuid",nullable:false),OwnerId=t.Column<Guid>(type:"uuid",nullable:false),Status=t.Column<string>(type:"character varying(20)",maxLength:20,nullable:false),Revision=t.Column<Guid>(type:"uuid",nullable:false),UpdatedAt=t.Column<DateTime>(type:"timestamp with time zone",nullable:false)},constraints:t=>{
            t.PrimaryKey("PK_ConversationLeads",x=>x.ConversationId);t.CheckConstraint("CK_ConversationLeads_Status","\"Status\" IN ('New','InProgress','NotRelevant')");t.ForeignKey("FK_ConversationLeads_Users_OwnerId",x=>x.OwnerId,"Users","UserId",onDelete:ReferentialAction.Restrict);
        });
        m.CreateIndex("IX_ConversationLeads_OwnerId","ConversationLeads","OwnerId");
    }
    protected override void Down(MigrationBuilder m)=>throw new NotSupportedException("Retain alert choices, reminders, draft receipts and lead notes; roll forward without deleting data.");
}
