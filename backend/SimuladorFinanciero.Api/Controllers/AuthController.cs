using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SimuladorFinanciero.Api.DTOs.Auth;
using SimuladorFinanciero.Api.Services;

namespace SimuladorFinanciero.Api.Controllers;

[ApiController]
[Route("auth")]
[ProducesResponseType(StatusCodes.Status500InternalServerError)]
public class AuthController : ControllerBase
{
    private readonly IAuthService _auth;

    public AuthController(IAuthService auth) => _auth = auth;

    private long GetUserId() =>
        long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
                   ?? throw new InvalidOperationException("Token inválido: no contiene el claim sub."));

    /// <summary>Registra un nuevo usuario y devuelve un token JWT.</summary>
    [HttpPost("register")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        var response = await _auth.RegistrarAsync(request);
        return StatusCode(StatusCodes.Status201Created, response);
    }

    /// <summary>Valida credenciales y devuelve un token JWT.</summary>
    [HttpPost("login")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var response = await _auth.LoginAsync(request);
        if (response is null)
            return Unauthorized(new ProblemDetails
            {
                Status = StatusCodes.Status401Unauthorized,
                Title  = "No autorizado",
                Detail = "Credenciales incorrectas."
            });

        return Ok(response);
    }

    /// <summary>Envía un email con un enlace para restablecer la contraseña, si el email existe.</summary>
    [HttpPost("forgot-password")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request)
    {
        await _auth.SolicitarResetPasswordAsync(request);
        return Ok(new { message = "Si el email existe, vas a recibir un enlace para restablecer tu contraseña." });
    }

    /// <summary>Establece una nueva contraseña a partir de un token de recuperación válido.</summary>
    [HttpPost("reset-password")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest request)
    {
        await _auth.ResetearPasswordAsync(request);
        return Ok(new { message = "Contraseña actualizada correctamente." });
    }

    /// <summary>Actualiza los datos del usuario autenticado (no incluye contraseña ni rol).</summary>
    [HttpPut("me")]
    [Authorize]
    [ProducesResponseType(typeof(PerfilResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UpdateMe(ActualizarPerfilRequest request) =>
        Ok(await _auth.ActualizarPerfilAsync(GetUserId(), request));
}
