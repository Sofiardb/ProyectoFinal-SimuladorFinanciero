using Dapper;
using Microsoft.AspNetCore.Mvc;
using SimuladorFinanciero.Api.Infrastructure.Database;

namespace SimuladorFinanciero.Api.Controllers;

[ApiController]
[Route("health")]
public class HealthController : ControllerBase
{
    private readonly IDbConnectionFactory _db;

    public HealthController(IDbConnectionFactory db) => _db = db;

    /// <summary>Verifica que la API y la base de datos responden correctamente.</summary>
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        try
        {
            using var conn = _db.Crear();
            await conn.ExecuteScalarAsync("SELECT 1");
            return Ok(new { estado = "ok", db = "ok" });
        }
        catch (Exception ex)
        {
            return StatusCode(503, new { estado = "ok", db = "error", detalle = ex.Message });
        }
    }
}
