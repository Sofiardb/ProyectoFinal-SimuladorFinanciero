using System.Data;
using Dapper;

namespace SimuladorFinanciero.Api.Infrastructure.Database;

public sealed class DateOnlyTypeHandler : SqlMapper.TypeHandler<DateOnly>
{
    public static readonly DateOnlyTypeHandler Instance = new();

    public override DateOnly Parse(object value) => value switch
    {
        DateOnly d  => d,
        DateTime dt => DateOnly.FromDateTime(dt),
        _           => DateOnly.FromDateTime(Convert.ToDateTime(value))
    };

    public override void SetValue(IDbDataParameter parameter, DateOnly value) =>
        parameter.Value = value.ToDateTime(TimeOnly.MinValue);
}
