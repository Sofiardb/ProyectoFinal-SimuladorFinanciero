using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using SimuladorFinanciero.Api.Infrastructure.Exceptions;

namespace SimuladorFinanciero.Api.Infrastructure.Middleware;

public sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> log) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception   exception,
        CancellationToken cancellationToken)
    {
        var (status, title) = exception switch
        {
            NotFoundException    => (StatusCodes.Status404NotFound,           "No encontrado"),
            ConflictException    => (StatusCodes.Status409Conflict,           "Conflicto"),
            ExternalApiException => (StatusCodes.Status502BadGateway,         "Error de API externa"),
            _                    => (StatusCodes.Status500InternalServerError, "Error interno del servidor")
        };

        if (status == StatusCodes.Status500InternalServerError)
            log.LogError(exception, "Excepción no controlada.");

        var problem = new ProblemDetails
        {
            Status = status,
            Title  = title,
            Detail = exception.Message
        };

        httpContext.Response.StatusCode = status;
        await httpContext.Response.WriteAsJsonAsync(problem, cancellationToken);
        return true;
    }
}
