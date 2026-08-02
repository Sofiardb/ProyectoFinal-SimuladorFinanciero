using Dapper;
using SimuladorFinanciero.Api.Infrastructure.Database;
using SimuladorFinanciero.Api.Models;

namespace SimuladorFinanciero.Api.Repositories;

public interface IRegistroPendienteRepository
{
    Task<RegistroPendiente?> BuscarPorEmailAsync(string email);
    Task<RegistroPendiente?> BuscarPorUsernameAsync(string username);
    Task<RegistroPendiente?> BuscarPorTokenHashAsync(string tokenHash);
    Task<long> CrearAsync(RegistroPendiente registro);
    Task ActualizarTokenAsync(long idRegistroPendiente, string tokenHash, DateTimeOffset expira);
    Task EliminarAsync(long idRegistroPendiente);
    Task EliminarPorEmailAsync(string email);
}

public class RegistroPendienteRepository : IRegistroPendienteRepository
{
    private readonly IDbConnectionFactory _db;

    public RegistroPendienteRepository(IDbConnectionFactory db) => _db = db;

    public async Task<RegistroPendiente?> BuscarPorEmailAsync(string email)
    {
        using var conn = _db.Crear();
        return await conn.QuerySingleOrDefaultAsync<RegistroPendiente>(
            "SELECT * FROM registro_pendiente WHERE email = @email",
            new { email });
    }

    public async Task<RegistroPendiente?> BuscarPorUsernameAsync(string username)
    {
        using var conn = _db.Crear();
        return await conn.QuerySingleOrDefaultAsync<RegistroPendiente>(
            "SELECT * FROM registro_pendiente WHERE username = @username",
            new { username });
    }

    public async Task<RegistroPendiente?> BuscarPorTokenHashAsync(string tokenHash)
    {
        using var conn = _db.Crear();
        return await conn.QuerySingleOrDefaultAsync<RegistroPendiente>(
            "SELECT * FROM registro_pendiente WHERE token_hash = @tokenHash AND token_expira > NOW()",
            new { tokenHash });
    }

    public async Task<long> CrearAsync(RegistroPendiente registro)
    {
        using var conn = _db.Crear();
        const string sql = """
            INSERT INTO registro_pendiente (email, username, password_hash, nombre, apellido, token_hash, token_expira)
            VALUES (@Email, @Username, @PasswordHash, @Nombre, @Apellido, @TokenHash, @TokenExpira)
            RETURNING id_registro_pendiente
            """;
        return await conn.ExecuteScalarAsync<long>(sql, registro);
    }

    public async Task ActualizarTokenAsync(long idRegistroPendiente, string tokenHash, DateTimeOffset expira)
    {
        using var conn = _db.Crear();
        await conn.ExecuteAsync(
            """
            UPDATE registro_pendiente
            SET token_hash = @tokenHash, token_expira = @expira
            WHERE id_registro_pendiente = @idRegistroPendiente
            """,
            new { idRegistroPendiente, tokenHash, expira });
    }

    public async Task EliminarAsync(long idRegistroPendiente)
    {
        using var conn = _db.Crear();
        await conn.ExecuteAsync(
            "DELETE FROM registro_pendiente WHERE id_registro_pendiente = @idRegistroPendiente",
            new { idRegistroPendiente });
    }

    public async Task EliminarPorEmailAsync(string email)
    {
        using var conn = _db.Crear();
        await conn.ExecuteAsync(
            "DELETE FROM registro_pendiente WHERE email = @email",
            new { email });
    }
}
