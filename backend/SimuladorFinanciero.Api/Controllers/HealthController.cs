using Dapper;
using Microsoft.AspNetCore.Mvc;
using SimuladorFinanciero.Api.Infrastructure.Database;

namespace SimuladorFinanciero.Api.Controllers;

[ApiController]
[Route("health")]
public class HealthController : ControllerBase
{
    private readonly IDbConnectionFactory _db;
    private readonly ILogger<HealthController> _log;

    public HealthController(IDbConnectionFactory db, ILogger<HealthController> log)
    {
        _db  = db;
        _log = log;
    }

    /// <summary>Verifica que la API y la base de datos responden correctamente.</summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
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
            // El detalle (puede incluir el connection string) queda solo en los logs del server,
            // nunca en la respuesta — este endpoint es público y sin autenticación.
            _log.LogError(ex, "Health check: la base de datos no respondió.");
            return StatusCode(503, new { estado = "ok", db = "error" });
        }
    }
}
