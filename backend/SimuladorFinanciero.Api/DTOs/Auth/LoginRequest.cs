using System.ComponentModel.DataAnnotations;

namespace SimuladorFinanciero.Api.DTOs.Auth;

public class LoginRequest
{
    [Required(ErrorMessage = "El identificador es obligatorio.")]
    public string Identificador { get; set; } = "";

    [Required(ErrorMessage = "La contraseña es obligatoria.")]
    public string Password { get; set; } = "";
}
