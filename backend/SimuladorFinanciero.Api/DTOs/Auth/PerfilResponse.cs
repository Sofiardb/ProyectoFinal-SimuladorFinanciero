namespace SimuladorFinanciero.Api.DTOs.Auth;

public class PerfilResponse
{
    public string Email { get; set; } = "";
    public string Username { get; set; } = "";
    public string? Nombre { get; set; }
    public string? Apellido { get; set; }
    public bool EsAdmin { get; set; }
}
