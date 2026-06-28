using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using SimuladorFinanciero.Api.DTOs.Auth;
using SimuladorFinanciero.Api.Models;
using SimuladorFinanciero.Api.Repositories;

namespace SimuladorFinanciero.Api.Services;

public interface IAuthService
{
    Task<AuthResponse> RegistrarAsync(RegisterRequest request);
    Task<AuthResponse?> LoginAsync(LoginRequest request);
}

public class AuthService : IAuthService
{
    private readonly IUsuarioRepository _usuarios;
    private readonly IConfiguration _config;

    public AuthService(IUsuarioRepository usuarios, IConfiguration config)
    {
        _usuarios = usuarios;
        _config = config;
    }

    public async Task<AuthResponse> RegistrarAsync(RegisterRequest request)
    {
        if (await _usuarios.BuscarPorEmailAsync(request.Email) is not null)
            throw new InvalidOperationException("El email ya está registrado.");

        if (await _usuarios.BuscarPorUsernameAsync(request.Username) is not null)
            throw new InvalidOperationException("El nombre de usuario ya está en uso.");

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
            EsAdmin   = usuario.EsAdmin
        };
    }
}
