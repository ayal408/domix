using AutoMapper;
using serverApi.Models;
using serverApi.Models.DTOs;

namespace serverApi.Mappers
{
    public class UserProfile : Profile
    {
        public UserProfile()
        {
            // Entity -> DTO
            CreateMap<User, UserResponseDto>();

            // DTO -> Entity (create)
            CreateMap<UserDto, User>()
                .ForMember(dest => dest.PasswordHash, opt => opt.MapFrom(src => src.PasswordHash))
                .ForMember(dest => dest.UserId, opt => opt.MapFrom(src => Guid.NewGuid()))
                .ForMember(dest => dest.JoiningDate, opt => opt.MapFrom(src => DateTime.UtcNow));

            // DTO -> Entity (update)
            CreateMap<UserDto, User>()
                .ForAllMembers(opt => opt.Condition((src, dest, srcMember) => srcMember != null));
        }
    }
}