using Npgsql;
using System.Data;

namespace SimuladorFinanciero.Api.Infrastructure.Database;

public interface IDbConnectionFactory
{
    IDbConnection Crear();
}

public class DbConnectionFactory : IDbConnectionFactory
{
    private readonly string _connectionString;

    public DbConnectionFactory(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("Postgres")
            ?? throw new InvalidOperationException("ConnectionStrings:Postgres no está configurada.");
    }

    public IDbConnection Crear() => new NpgsqlConnection(_connectionString);
}
