using FluentAssertions;
using Microsoft.AspNetCore.Http;
using SimuladorFinanciero.Api.Infrastructure.Exceptions;
using SimuladorFinanciero.Api.Infrastructure.Middleware;

namespace SimuladorFinanciero.Tests.Infrastructure;

public class GlobalExceptionHandlerTests
{
    [Fact]
    public void MapException_NotFoundException_Devuelve404()
    {
        var (status, title) = GlobalExceptionHandler.MapException(new NotFoundException("no existe"));
        status.Should().Be(StatusCodes.Status404NotFound);
        title.Should().Be("No encontrado");
    }

    [Fact]
    public void MapException_ConflictException_Devuelve409()
    {
        var (status, title) = GlobalExceptionHandler.MapException(new ConflictException("ya existe"));
        status.Should().Be(StatusCodes.Status409Conflict);
        title.Should().Be("Conflicto");
    }

    [Fact]
    public void MapException_ExternalApiException_Devuelve502()
    {
        var (status, title) = GlobalExceptionHandler.MapException(new ExternalApiException("api caida"));
        status.Should().Be(StatusCodes.Status502BadGateway);
        title.Should().Be("Error de API externa");
    }

    [Fact]
    public void MapException_ExcepcionNoControlada_Devuelve500()
    {
        var (status, title) = GlobalExceptionHandler.MapException(new InvalidOperationException("bug"));
        status.Should().Be(StatusCodes.Status500InternalServerError);
        title.Should().Be("Error interno del servidor");
    }

    [Fact]
    public void MapException_ValidationException_Devuelve422()
    {
        var (status, title) = GlobalExceptionHandler.MapException(new ValidationException("perfil inválido"));
        status.Should().Be(StatusCodes.Status422UnprocessableEntity);
        title.Should().Be("Error de validación");
    }

    [Fact]
    public void MapException_ExceptionBase_Devuelve500()
    {
        var (status, _) = GlobalExceptionHandler.MapException(new Exception("genérica"));
        status.Should().Be(StatusCodes.Status500InternalServerError);
    }

    [Fact]
    public void ResolverDetail_ExcepcionNoControlada_DevuelveMensajeGenerico()
    {
        var detail = GlobalExceptionHandler.ResolverDetail(
            new InvalidOperationException("Sequence contains no elements"), StatusCodes.Status500InternalServerError);

        detail.Should().Be("Ocurrió un error inesperado. Intentá de nuevo en unos segundos.");
    }

    [Fact]
    public void ResolverDetail_ExcepcionDefinida_DevuelveMensajeOriginal()
    {
        var detail = GlobalExceptionHandler.ResolverDetail(
            new NotFoundException("Portfolio 1 no encontrado."), StatusCodes.Status404NotFound);

        detail.Should().Be("Portfolio 1 no encontrado.");
    }
}
