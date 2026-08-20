namespace SimuladorFinanciero.Api.DTOs.Simulacion;

public sealed record TenenciasSimulacionData(
    IReadOnlyList<AccionTenenciaSimulacion>    Acciones,
    IReadOnlyList<BonoTenenciaSimulacion>      Bonos,
    IReadOnlyList<LetraTenenciaSimulacion>     Letras,
    IReadOnlyList<PlazoFijoTenenciaSimulacion> PlazosFijos
);

public sealed record AccionTenenciaSimulacion(
    long     IdAccion,
    string   Ticker,
    decimal  Cantidad,
    decimal  PrecioCompra,
    decimal? Mu,
    decimal? Sigma,
    decimal? Rho
);

public sealed record BonoTenenciaSimulacion(
    long     IdBono,
    string   Ticker,
    string   Tipo,
    decimal  Cantidad,
    decimal  PrecioCompra,
    decimal  TasaDescuento,
    IReadOnlyList<FlujoSimulacion> Flujos
);

public sealed record FlujoSimulacion(
    DateOnly FechaPago,
    decimal  MontoCupon,
    decimal  MontoCapital
);

public sealed record LetraTenenciaSimulacion(
    long     IdLetra,
    string   Tipo,
    decimal  Cantidad,
    decimal  PrecioCompra,
    decimal  Tna,
    DateOnly FechaVencimiento
);

public sealed record PlazoFijoTenenciaSimulacion(
    long     IdPortfolioPlazoFijo,
    string   TipoCodigo,
    string   MonedaCodigo,
    decimal  MontoInvertido,
    decimal  TnaPactada,
    DateOnly FechaInicio,
    int      DuracionDias,
    bool     ReinvertirAlVencimiento,
    string   EntidadFinanciera = "",
    string   NombreTipoPlazoFijo = ""
);

public sealed record EscenarioSimulacion(
    int     IdTipoEscenario,
    string  Codigo,
    decimal InflacionMensualMin,
    decimal InflacionMensualMax,
    decimal InflacionMensualMinUsd,
    decimal InflacionMensualMaxUsd
);

public sealed record InsertSimulacionData(
    long     IdPortfolio,
    int      HorizonteMeses,
    int      NumTrayectorias,
    long     SeedAleatoria,
    decimal  ValorInicial,
    decimal? ValorEsperado,
    decimal? ValorMinimo,
    decimal? ValorMaximo,
    decimal? RetornoEsperadoPct,
    decimal? RendimientoRealPct,
    decimal? DesvioEstandar,
    decimal? ValorInicialArs,
    decimal? ValorInicialUsd,
    decimal? ValorEsperadoArs,
    decimal? ValorEsperadoUsd,
    decimal? ValorMinimoArs,
    decimal? ValorMinimoUsd,
    decimal? ValorMaximoArs,
    decimal? ValorMaximoUsd,
    decimal? RetornoEsperadoPctArs,
    decimal? RetornoEsperadoPctUsd,
    decimal? RendimientoRealPctArs,
    decimal? RendimientoRealPctUsd
);

public sealed record InstrumentoSimulacionSnapshot(
    string   Ambito,
    string   Tipo,
    long?    IdAccion,
    long?    IdBono,
    long?    IdLetra,
    long?    IdPortfolioPlazoFijo,
    decimal  Monto,
    string   ParametrosJson,
    string?  EntidadFinanciera = null,
    string?  NombreTipoPlazoFijo = null,
    string?  CodigoMoneda = null
);
