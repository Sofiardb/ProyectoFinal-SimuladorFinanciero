using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using SimuladorFinanciero.Api.DTOs.Auth;
using SimuladorFinanciero.Api.Infrastructure.Exceptions;
using SimuladorFinanciero.Api.Models;
using SimuladorFinanciero.Api.Repositories;

namespace SimuladorFinanciero.Api.Services;

public interface IAuthService
{
    Task<AuthResponse> RegistrarAsync(RegisterRequest request);
    Task<AuthResponse?> LoginAsync(LoginRequest request);
    Task SolicitarResetPasswordAsync(ForgotPasswordRequest request);
    Task ResetearPasswordAsync(ResetPasswordRequest request);
    Task<PerfilResponse> ActualizarPerfilAsync(long idUsuario, ActualizarPerfilRequest request);
}

public class AuthService : IAuthService
{
    private readonly IUsuarioRepository _usuarios;
    private readonly IEmailService _email;
    private readonly IConfiguration _config;

    public AuthService(IUsuarioRepository usuarios, IEmailService email, IConfiguration config)
    {
        _usuarios = usuarios;
        _email = email;
        _config = config;
    }

    public async Task<AuthResponse> RegistrarAsync(RegisterRequest request)
    {
        if (await _usuarios.BuscarPorEmailAsync(request.Email) is not null)
            throw new ConflictException("El email ya está registrado.");

        if (await _usuarios.BuscarPorUsernameAsync(request.Username) is not null)
            throw new ConflictException("El nombre de usuario ya está en uso.");

        var usuario = new Usuario
        {
            Email        = request.Email.Trim().ToLowerInvariant(),
            Username     = request.Username.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Nombre       = request.Nombre,
            Apellido     = request.Apellido
        };

        usuario.IdUsuario = await _usuarios.CrearAsync(usuario);

        return GenerarToken(usuario);
    }

    public async Task<AuthResponse?> LoginAsync(LoginRequest request)
    {
        var id = request.Identificador.Trim();
        var usuario = id.Contains('@')
            ? await _usuarios.BuscarPorEmailAsync(id.ToLowerInvariant())
            : await _usuarios.BuscarPorUsernameAsync(id);

        if (usuario is null || !BCrypt.Net.BCrypt.Verify(request.Password, usuario.PasswordHash))
            return null;

        await _usuarios.ActualizarUltimoLoginAsync(usuario.IdUsuario);

        return GenerarToken(usuario);
    }

    public async Task SolicitarResetPasswordAsync(ForgotPasswordRequest request)
    {
        var usuario = await _usuarios.BuscarPorEmailAsync(request.Email.Trim().ToLowerInvariant());
        if (usuario is null) return; // no revelar si el email existe

        var token     = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var tokenHash = HashToken(token);
        var expira    = DateTimeOffset.UtcNow.AddMinutes(30);

        await _usuarios.GuardarResetTokenAsync(usuario.IdUsuario, tokenHash, expira);

        var frontendUrl = _config["Frontend:BaseUrl"] ?? "http://localhost:5173";
        var resetLink   = $"{frontendUrl}/reset-password?token={token}";

        var cuerpo = $"""
            <p>Hola {usuario.Nombre ?? usuario.Username},</p>
            <p>Recibimos una solicitud para restablecer tu contraseña en InvestLab.</p>
            <p><a href="{resetLink}">Hacé clic acá para elegir una nueva contraseña</a>. Este enlace vence en 30 minutos.</p>
            <p>Si no solicitaste esto, podés ignorar este email.</p>
            """;

        await _email.EnviarEmailAsync(usuario.Email, "Restablecer tu contraseña — InvestLab", cuerpo);
    }

    public async Task ResetearPasswordAsync(ResetPasswordRequest request)
    {
        var usuario = await _usuarios.BuscarPorResetTokenHashAsync(HashToken(request.Token));
        if (usuario is null)
            throw new ValidationException("El enlace de recuperación es inválido o expiró.");

        await _usuarios.ActualizarPasswordAsync(usuario.IdUsuario, BCrypt.Net.BCrypt.HashPassword(request.NewPassword));
    }

    public async Task<PerfilResponse> ActualizarPerfilAsync(long idUsuario, ActualizarPerfilRequest request)
    {
        var usuario = await _usuarios.BuscarPorIdAsync(idUsuario)
            ?? throw new NotFoundException("Usuario no encontrado.");

        var email    = request.Email.Trim().ToLowerInvariant();
        var username = request.Username.Trim();

        var porEmail = await _usuarios.BuscarPorEmailAsync(email);
        if (porEmail is not null && porEmail.IdUsuario != idUsuario)
            throw new ConflictException("El email ya está registrado.");

        var porUsername = await _usuarios.BuscarPorUsernameAsync(username);
        if (porUsername is not null && porUsername.IdUsuario != idUsuario)
            throw new ConflictException("El nombre de usuario ya está en uso.");

        await _usuarios.ActualizarPerfilAsync(idUsuario, email, username, request.Nombre, request.Apellido);

        return new PerfilResponse
        {
            Email    = email,
            Username = username,
            Nombre   = request.Nombre,
            Apellido = request.Apellido,
            EsAdmin  = usuario.EsAdmin
        };
    }

    private static string HashToken(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    private AuthResponse GenerarToken(Usuario usuario)
    {
        var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var expMinutes = int.TryParse(_config["Jwt:ExpiresInMinutes"], out var m) ? m : 60;
        var expiresAt  = DateTimeOffset.UtcNow.AddMinutes(expMinutes);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub,   usuario.IdUsuario.ToString()),
            new(JwtRegisteredClaimNames.Email, usuario.Email ?? ""),
            new(JwtRegisteredClaimNames.Jti,   Guid.NewGuid().ToString())
        };

        if (usuario.EsAdmin)
            claims.Add(new Claim(ClaimTypes.Role, "Admin"));

        var token = new JwtSecurityToken(
            issuer:             _config["Jwt:Issuer"],
            audience:           _config["Jwt:Audience"],
            claims:             claims,
            expires:            expiresAt.UtcDateTime,
            signingCredentials: creds);

        return new AuthResponse
        {
            Token     = new JwtSecurityTokenHandler().WriteToken(token),
            ExpiresAt = expiresAt,
            Email     = usuario.Email,
            Username  = usuario.Username,
            Nombre    = usuario.Nombre,
            Apellido  = usuario.Apellido,
            EsAdmin   = usuario.EsAdmin
        };
    }
}
