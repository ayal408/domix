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
        public DbSet<ApartmentRating> ApartmentRatings { get; set; }
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

        public DbSet<SystemEmailSettings> SystemEmailSettings { get; set; }
        public DbSet<SavedSearchEmail> SavedSearchEmails { get; set; }
        public DbSet<EmailDelivery> EmailDeliveries { get; set; }

        private void PrepareDerivedValues()
        {
            foreach (var entry in ChangeTracker.Entries<User>().Where(e => e.State is EntityState.Added or EntityState.Modified))
                entry.Entity.NormalizedEmail = string.IsNullOrWhiteSpace(entry.Entity.EmailAddress) ? null : entry.Entity.EmailAddress.Trim().ToLowerInvariant();
            foreach (var entry in ChangeTracker.Entries<Apartment>().Where(e => e.State is EntityState.Added or EntityState.Modified))
                entry.Entity.NormalizedCity = entry.Entity.city.Trim().ToLowerInvariant();
        }
        public override int SaveChanges(bool acceptAllChangesOnSuccess)
        {
            PrepareDerivedValues();
            return base.SaveChanges(acceptAllChangesOnSuccess);
        }
        public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
        {
            PrepareDerivedValues();
            return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.Entity<SystemEmailSettings>().Property(s => s.Provider).HasDefaultValue("gmail");
            modelBuilder.Entity<User>().HasQueryFilter(x => !x.IsDeleted);
            modelBuilder.Entity<Apartment>().HasQueryFilter(x => !x.IsDeleted);
            modelBuilder.Entity<User>().Property(x => x.NormalizedEmail)
                .HasComputedColumnSql("NULLIF(lower(trim(\"EmailAddress\")), '')", stored: true);
            modelBuilder.Entity<User>().HasIndex(x => x.NormalizedEmail).IsUnique();
            modelBuilder.Entity<Apartment>().Property(x => x.NormalizedCity)
                .HasComputedColumnSql("lower(trim(city))", stored: true);
            modelBuilder.Entity<Apartment>().Property(x => x.price).HasPrecision(14, 2);
            modelBuilder.Entity<Apartment>().HasIndex(x => new { x.NormalizedCity, x.ListingType, x.AvailableFrom, x.AvailableTo });
            modelBuilder.Entity<Apartment>().HasIndex(x => new { x.dateInsert, x.ApartmentId }).IsDescending(true, false)
                .HasFilter("\"Status\" = 0 AND NOT \"IsDeleted\"");
            modelBuilder.Entity<Message>().HasIndex(x => new { x.OwnerId, x.IsArchived, x.CreatedAt, x.MessageId })
                .IsDescending(false, false, true, true).HasFilter("NOT \"IsDeleted\"");
            modelBuilder.Entity<Message>().HasOne<Apartment>().WithMany().HasForeignKey(x => x.ApartmentId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<Message>().HasOne<Apartment>().WithMany().HasForeignKey(x => x.OfferedApartmentId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<Message>().HasOne(x => x.Sender).WithMany().HasForeignKey(x => x.SenderId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<Message>().HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<Apartment>().HasOne(x => x.User).WithMany(x => x.Apartments).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<ClosingDeal>().HasOne<User>().WithMany().HasForeignKey(x => x.idUserManager).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<ClosingDeal>().HasOne<User>().WithMany().HasForeignKey(x => x.idUserBuyer).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<ClosingDeal>().HasOne(x => x.apartment).WithMany(x => x.ClosingDeal).HasForeignKey(x => x.ApartmentId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<ApartmentRating>().HasKey(x => new { x.ApartmentId, x.UserId });
            modelBuilder.Entity<ApartmentRating>().HasOne(x => x.Apartment).WithMany().HasForeignKey(x => x.ApartmentId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<ApartmentRating>().HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<Apartment>().ToTable(t =>
            {
                t.HasCheckConstraint("CK_Apartments_ListingType", "\"IsDeleted\" OR (\"ListingType\" IN ('Unspecified','Exchange','Rent','Sale'))");
                t.HasCheckConstraint("CK_Apartments_Status", "\"IsDeleted\" OR (\"Status\" IN (0,1,2))");
                t.HasCheckConstraint("CK_Apartments_Price", "\"IsDeleted\" OR (price >= 0 AND (\"ListingType\" = 'Exchange' OR price > 0))");
                t.HasCheckConstraint("CK_Apartments_Address", "\"IsDeleted\" OR (trim(city) <> '' AND trim(address) <> '' AND trim(area) <> '')");
                t.HasCheckConstraint("CK_Apartments_Dimensions", "\"IsDeleted\" OR ((\"SumOfRooms\" IS NULL OR \"SumOfRooms\" > 0) AND (\"SquareMeters\" IS NULL OR \"SquareMeters\" > 0) AND (\"SumOfBeds\" IS NULL OR \"SumOfBeds\" >= 0))");
                t.HasCheckConstraint("CK_Apartments_ExchangeDates", "\"IsDeleted\" OR (\"ListingType\" <> 'Exchange' OR (\"AvailableFrom\" IS NOT NULL AND \"AvailableTo\" IS NOT NULL AND \"AvailableTo\" > \"AvailableFrom\" AND \"DesiredCity\" IS NOT NULL AND trim(\"DesiredCity\") <> ''))");
                t.HasCheckConstraint("CK_Apartments_RecordedRating", "\"RecordedRatingCount\" >= 0 AND \"RatingSum\" >= \"RecordedRatingCount\" AND \"RatingSum\" <= 5 * CAST(\"RecordedRatingCount\" AS bigint)");
            });
            modelBuilder.Entity<ApartmentRating>().ToTable(t => t.HasCheckConstraint("CK_ApartmentRatings_Score", "\"Score\" BETWEEN 1 AND 5"));
            modelBuilder.Entity<User>().ToTable(t => t.HasCheckConstraint("CK_Users_Role", "\"Role\" IN ('User','Manager','Admin')"));
            modelBuilder.Entity<SavedSearch>().ToTable(t => t.HasCheckConstraint("CK_SavedSearches_Ranges", "(\"MinPrice\" IS NULL OR \"MinPrice\" >= 0) AND (\"MaxPrice\" IS NULL OR \"MaxPrice\" >= 0) AND (\"MinPrice\" IS NULL OR \"MaxPrice\" IS NULL OR \"MinPrice\" <= \"MaxPrice\") AND (\"MinRooms\" IS NULL OR \"MinRooms\" >= 0) AND (\"MaxRooms\" IS NULL OR \"MaxRooms\" >= 0) AND (\"MinRooms\" IS NULL OR \"MaxRooms\" IS NULL OR \"MinRooms\" <= \"MaxRooms\")"));
            modelBuilder.Entity<Message>().ToTable(t => t.HasCheckConstraint("CK_Messages_Exchange", "(\"OfferedApartmentId\" IS NULL AND \"ExchangeStart\" IS NULL AND \"ExchangeEnd\" IS NULL) OR (\"OfferedApartmentId\" IS NOT NULL AND \"ApartmentId\" IS NOT NULL AND \"ExchangeStart\" IS NOT NULL AND \"ExchangeEnd\" IS NOT NULL AND \"ExchangeEnd\" > \"ExchangeStart\" AND \"SenderId\" <> \"OwnerId\")"));
            modelBuilder.Entity<SavedSearchEmail>().ToTable(t => t.HasCheckConstraint("CK_SavedSearchEmails_Status", "\"Status\" IN ('Pending','Sending','Sent','Blocked','Unknown','Cancelled')"));
            modelBuilder.Entity<SystemEmailSettings>().Property(x => x.Id).ValueGeneratedNever();
            modelBuilder.Entity<EmailDelivery>().HasIndex(x => x.CreatedAt);

            modelBuilder.Entity<SavedSearchEmail>().HasIndex(x => new { x.SavedSearchId, x.FromAt }).IsUnique();
            modelBuilder.Entity<SavedSearchEmail>().HasIndex(x => new { x.Status, x.CreatedAt });
            modelBuilder.Entity<SavedSearchEmail>().HasOne(x => x.SavedSearch).WithMany()
                .HasForeignKey(x => x.SavedSearchId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<RefreshToken>().HasIndex(x => x.Token).IsUnique();

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
                .OnDelete(DeleteBehavior.Restrict);

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
