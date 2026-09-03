using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using serverApi.Services.Interfaces;

namespace serverApi.Controllers
{
    /// <summary>Israeli city/street autocomplete backed by data.gov.il — see IsraeliAddressService.</summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AddressController : ControllerBase
    {
        private readonly IIsraeliAddressService _addressService;

        public AddressController(IIsraeliAddressService addressService)
        {
            _addressService = addressService;
        }

        // GET: api/Address/cities?query=תל
        [HttpGet("cities")]
        public async Task<ActionResult<IEnumerable<string>>> SearchCities([FromQuery] string query, CancellationToken cancellationToken)
        {
            var results = await _addressService.SearchCitiesAsync(query ?? string.Empty, cancellationToken);
            return Ok(results);
        }

        // GET: api/Address/streets?city=תל אביב&query=דיז
        [HttpGet("streets")]
        public async Task<ActionResult<IEnumerable<string>>> SearchStreets([FromQuery] string city, [FromQuery] string query, CancellationToken cancellationToken)
        {
            var results = await _addressService.SearchStreetsAsync(city ?? string.Empty, query ?? string.Empty, cancellationToken);
            return Ok(results);
        }
    }
}
