using System.ComponentModel.DataAnnotations;

namespace SimuladorFinanciero.Api.DTOs.Auth;

public class ActualizarPerfilRequest
{
    [Required(ErrorMessage = "El email es obligatorio.")]
    [EmailAddress(ErrorMessage = "El formato del email no es válido.")]
    public string Email { get; set; } = "";

    [Required(ErrorMessage = "El nombre de usuario es obligatorio.")]
    public string Username { get; set; } = "";

    public string? Nombre { get; set; }
    public string? Apellido { get; set; }
}
