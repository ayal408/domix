using Microsoft.EntityFrameworkCore;
using serverApi.Models;

namespace serverApi.Data
{
    public class ApartmentContext : DbContext
    {
        public ApartmentContext(DbContextOptions<ApartmentContext> options) : base(options)
        {
        }

        public DbSet<User> Users { get; set; }
        public DbSet<Apartment> Apartments { get; set; }
        public DbSet<Appointment> Appointments { get; set; }
        public DbSet<SearchRequest> SearchRequests { get; set; }
        public DbSet<ClosingDeal> ClosingDeals { get; set; }
        public DbSet<ApartmentImage> ApartmentImages { get; set; }
        public DbSet<RefreshToken> RefreshTokens { get; set; }
        public DbSet<Tag> Tags { get; set; }
        public DbSet<Message> Messages { get; set; }
        public DbSet<Favorite> Favorites { get; set; }
        public DbSet<SavedSearch> SavedSearches { get; set; }
        public DbSet<SupportTicket> SupportTickets { get; set; }
        public DbSet<Notification> Notifications { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // HasFilter emits raw Postgres SQL, which the EF Core InMemory provider (used by
            // domix-server.Tests to unit-test services that touch ApartmentContext) can't
            // translate -- it isn't a relational provider at all. Guarding these two keeps the
            // model buildable there without changing anything about the real Npgsql-backed index.
            var supportsSqlFilters = Database.IsNpgsql();

            modelBuilder.Entity<User>(entity =>
            {
                entity.HasKey(x => x.UserId);

                // UNIQUE: Email
                var emailIndex = entity.HasIndex(x => x.EmailAddress).IsUnique();
                if (supportsSqlFilters) emailIndex.HasFilter("\"EmailAddress\" IS NOT NULL");

                // UNIQUE: Username
                entity.HasIndex(x => x.UserName)
                      .IsUnique();

                // UNIQUE: GoogleId
                var googleIdIndex = entity.HasIndex(x => x.GoogleId).IsUnique();
                if (supportsSqlFilters) googleIdIndex.HasFilter("\"GoogleId\" IS NOT NULL");
            });

            modelBuilder.Entity<Apartment>()
                .HasIndex(a => a.city)
                .HasDatabaseName("IX_Apartments_City");

            modelBuilder.Entity<Apartment>()
                .HasIndex(a => a.price)
                .HasDatabaseName("IX_Apartments_Price");

            modelBuilder.Entity<Apartment>()
                .HasIndex(a => new { a.Latitude, a.Longitude })
                .HasDatabaseName("IX_Apartments_Location");

            modelBuilder.Entity<Appointment>()
                .HasOne(a => a.User)
                .WithMany(u => u.Appointments)
                .HasForeignKey(a => a.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Appointment>()
                .HasOne(a => a.Apartment)
                .WithMany(a => a.Appointments)
                .HasForeignKey(a => a.ApartmentId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Favorite>()
                .HasIndex(f => new { f.UserId, f.ApartmentId })
                .IsUnique();

            modelBuilder.Entity<Favorite>()
                .HasOne(f => f.User)
                .WithMany()
                .HasForeignKey(f => f.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Favorite>()
                .HasOne(f => f.Apartment)
                .WithMany()
                .HasForeignKey(f => f.ApartmentId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<SavedSearch>()
                .HasOne(s => s.User)
                .WithMany()
                .HasForeignKey(s => s.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<SupportTicket>()
                .HasOne(t => t.User)
                .WithMany()
                .HasForeignKey(t => t.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Notification>()
                .HasOne(n => n.CreatedByUser)
                .WithMany()
                .HasForeignKey(n => n.CreatedByUserId)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }
}