using FluentValidation;
using serverApi.Models;
using serverApi.Models.DTOs;

namespace serverApi.Validators
{
    public class ApartmentValidator : AbstractValidator<ApartmentDTO>
    {
        public ApartmentValidator()
        {
            RuleFor(x => x.city)
                .NotEmpty().WithMessage("City is required");

            RuleFor(x => x.price)
                .GreaterThan(0).WithMessage("Price must be greater than 0");

            RuleFor(x => x.address)
                .NotEmpty().WithMessage("Address is required");
        }
    }
}