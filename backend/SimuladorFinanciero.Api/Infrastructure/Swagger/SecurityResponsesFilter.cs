using Microsoft.AspNetCore.Authorization;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace SimuladorFinanciero.Api.Infrastructure.Swagger;

/// <summary>
/// Agrega automáticamente 401, 403 y 500 a todas las operaciones que corresponda,
/// sin necesidad de decorar cada endpoint con [ProducesResponseType].
/// </summary>
public sealed class SecurityResponsesFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var authorizeAttrs = context.MethodInfo.DeclaringType?
            .GetCustomAttributes(true)
            .Union(context.MethodInfo.GetCustomAttributes(true))
            .OfType<AuthorizeAttribute>()
            .ToList() ?? [];

        if (authorizeAttrs.Count > 0)
        {
            operation.Responses.TryAdd("401", new OpenApiResponse
            {
                Description = "No autenticado — token JWT ausente o inválido."
            });

            var requiereRol = authorizeAttrs.Any(a => !string.IsNullOrEmpty(a.Roles));
            if (requiereRol)
            {
                operation.Responses.TryAdd("403", new OpenApiResponse
                {
                    Description = "Sin permisos suficientes (se requiere rol Admin)."
                });
            }
        }

        operation.Responses.TryAdd("500", new OpenApiResponse
        {
            Description = "Error interno del servidor."
        });
    }
}
