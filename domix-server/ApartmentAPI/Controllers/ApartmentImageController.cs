using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using serverApi.Models.DTOs;
using serverApi.Services.Interfaces;

namespace serverApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize] // אבטחה גורפת לכל פעולות התמונות
    public class ApartmentImageController : ControllerBase
    {
        private readonly IApartmentImageService _imageService;
        private readonly ILogger<ApartmentImageController> _logger;

        public ApartmentImageController(IApartmentImageService imageService, ILogger<ApartmentImageController> logger)
        {
            _imageService = imageService;
            _logger = logger;
        }

        // =========================
        // GET ALL IMAGES
        // =========================
        [HttpGet]
        public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
        {
            var images = await _imageService.GetAllImagesAsync(cancellationToken);
            return Ok(images);
        }

        // =========================
        // CREATE IMAGE (DTO ONLY)
        // =========================
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] ApartmentImageDTO dto, CancellationToken cancellationToken)
        {
            if (dto == null)
                return BadRequest("Invalid data");

            try
            {
                var result = await _imageService.CreateImageAsync(dto, cancellationToken);
                return Ok(result);
            }
            catch (KeyNotFoundException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // =========================
        // UPLOAD IMAGE (FILE)
        // =========================
        [HttpPost("upload")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> Upload([FromForm] UploadImageDto dto, CancellationToken cancellationToken)
        {
            if (dto?.Image == null || dto.Image.Length == 0)
                return BadRequest("No image provided");

            try
            {
                var result = await _imageService.UploadImageAsync(dto, cancellationToken);
                return Ok(result);
            }
            catch (KeyNotFoundException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while uploading image.");
                return StatusCode(500, "Internal server error occurred during image upload.");
            }
        }
    }
}