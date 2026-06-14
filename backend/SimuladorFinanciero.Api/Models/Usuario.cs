namespace SimuladorFinanciero.Api.Models;

public class Usuario
{
    public long IdUsuario { get; set; }
    public required string Username { get; set; }
    public required string Email { get; set; }
    public string PasswordHash { get; set; } = "";
    public string? Nombre { get; set; }
    public string? Apellido { get; set; }
    public DateTimeOffset FechaRegistro { get; set; }
    public DateTimeOffset? FechaUltimoLogin { get; set; }
    public bool Activo { get; set; }
}
