namespace SimuladorFinanciero.Api.DTOs.Auth;

public class AuthResponse
{
    public string Token { get; set; } = "";
    public DateTimeOffset ExpiresAt { get; set; }
    public string? Email { get; set; }
    public string? Username { get; set; }
    public string? Nombre { get; set; }
}
