using System.ComponentModel.DataAnnotations;
namespace serverApi.Models.DTOs;

public class CreateExchangeAgreementDto
{
    public Guid OfferedApartmentId { get; set; }
    public Guid RequestedApartmentId { get; set; }
    public DateOnly Start { get; set; }
    public DateOnly End { get; set; }
    [Range(1, 30)] public int Guests { get; set; } = 1;
    [MaxLength(2000)] public string Note { get; set; } = "";
}
public class ExchangeDecisionDto
{
    [Range(1, 30)] public int RecipientGuests { get; set; } = 1;
    [Required] public string Action { get; set; } = "";
    public int Revision { get; set; }
}
public class ExchangeCounterDto
{
    public int Revision { get; set; }
    public DateOnly Start { get; set; }
    public DateOnly End { get; set; }
    [Range(1, 30)] public int Guests { get; set; } = 1;
    [MaxLength(2000)] public string Note { get; set; } = "";
}
public class CalendarPeriodDto
{
    public DateOnly Start { get; set; }
    public DateOnly End { get; set; }
    public bool IsAvailable { get; set; } = true;
}

public class ExchangeReviewDto
{
    [Range(1, 5)] public int Score { get; set; }
    [MaxLength(1000)] public string Comment { get; set; } = "";
}
public class ExchangeReportDto
{
    public Guid ApartmentId { get; set; }
    [Required, MaxLength(2000)] public string Reason { get; set; } = "";
}
public class ExchangeWatchDto
{
    public Guid OfferedApartmentId { get; set; }
    [Required, MaxLength(100)] public string Destination { get; set; } = "";
    public DateOnly Start { get; set; }
    public DateOnly End { get; set; }
    [Range(0, 30)] public int Guests { get; set; }
    public bool KosherKitchen { get; set; }
    public bool SeparateBeds { get; set; }
    [Range(0, 10000)] public int? MaxSynagogueDistance { get; set; }
    [Required] public string Frequency { get; set; } = "Off";
}
