namespace serverApi.Service;

using Microsoft.EntityFrameworkCore;
using serverApi.Data;
using serverApi.Models.DTOs;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

public interface IApartmentService {
    Task<IEnumerable<ApartmentDTO>> GetAllAsync();
}

public class ApartmentService : IApartmentService {
    private readonly ApartmentContext _context;
    public ApartmentService(ApartmentContext context) => _context = context;

    public async Task<IEnumerable<ApartmentDTO>> GetAllAsync() {
        return await _context.Apartments
            .Select(a => new ApartmentDTO { 
                ApartmentId = a.ApartmentId, 
                city = a.city, 
                price = a.price 
            }).ToListAsync();
    }
}