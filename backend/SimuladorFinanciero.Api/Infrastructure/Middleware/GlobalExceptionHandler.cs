using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using SimuladorFinanciero.Api.Infrastructure.Exceptions;

namespace SimuladorFinanciero.Api.Infrastructure.Middleware;

public sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> log) : IExceptionHandler
{
    private const string MensajeGenerico = "Ocurrió un error inesperado. Intentá de nuevo en unos segundos.";

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception   exception,
        CancellationToken cancellationToken)
    {
        var (status, title) = MapException(exception);

        if (status == StatusCodes.Status500InternalServerError)
            log.LogError(exception, "Excepción no controlada.");

        var problem = new ProblemDetails
        {
            Status = status,
            Title  = title,
            Detail = ResolverDetail(exception, status)
        };

        httpContext.Response.StatusCode = status;
        await httpContext.Response.WriteAsJsonAsync(problem, cancellationToken);
        return true;
    }

    internal static (int Status, string Title) MapException(Exception exception) => exception switch
    {
        NotFoundException    => (StatusCodes.Status404NotFound,            "No encontrado"),
        ConflictException    => (StatusCodes.Status409Conflict,            "Conflicto"),
        ExternalApiException => (StatusCodes.Status502BadGateway,          "Error de API externa"),
        ValidationException  => (StatusCodes.Status422UnprocessableEntity, "Error de validación"),
        _                    => (StatusCodes.Status500InternalServerError,  "Error interno del servidor")
    };

    /// <summary>
    /// El mensaje de las excepciones "definidas" (404/409/422/502) es seguro de mostrar al usuario.
    /// Una excepción no controlada (500) nunca expone su mensaje interno — solo un texto genérico.
    /// </summary>
    internal static string ResolverDetail(Exception exception, int status) =>
        status == StatusCodes.Status500InternalServerError ? MensajeGenerico : exception.Message;
}
