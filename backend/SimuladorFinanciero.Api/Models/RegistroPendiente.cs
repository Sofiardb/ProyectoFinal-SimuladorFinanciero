namespace SimuladorFinanciero.Api.Models;

public class RegistroPendiente
{
    public long IdRegistroPendiente { get; set; }
    public required string Email { get; set; }
    public required string Username { get; set; }
    public string PasswordHash { get; set; } = "";
    public string? Nombre { get; set; }
    public string? Apellido { get; set; }
    public string TokenHash { get; set; } = "";
    public DateTimeOffset TokenExpira { get; set; }
    public DateTimeOffset FechaSolicitud { get; set; }
}
