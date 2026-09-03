namespace serverApi.Models.DTOs
{
    public class ChatTurnDto
    {
        public required string Role { get; set; } // "user" or "model"
        public required string Text { get; set; }
    }

    public class ChatStreamRequestDto
    {
        public required List<ChatTurnDto> History { get; set; }
    }

    public abstract class ChatStreamEvent
    {
    }

    public sealed class ChatTextChunk : ChatStreamEvent
    {
        public string Text { get; }

        public ChatTextChunk(string text)
        {
            Text = text;
        }
    }

    /// <summary>Emitted when the assistant used the search_apartments tool — carries the full
    /// listing data for the frontend to render as cards, separate from the compact summary
    /// fed back into the model as the function response.</summary>
    public sealed class ChatApartmentResults : ChatStreamEvent
    {
        public IReadOnlyList<ApartmentDTO> Apartments { get; }

        public ChatApartmentResults(IReadOnlyList<ApartmentDTO> apartments)
        {
            Apartments = apartments;
        }
    }
}
