using System.Text.Json;
using FluentAssertions;
using SimuladorFinanciero.Api.DTOs.Simulacion;
using SimuladorFinanciero.Api.Services;

namespace SimuladorFinanciero.Tests.Simulacion;

public class MotorPayloadBuilderTests
{
    private static readonly DateOnly Today = new(2026, 7, 1);

    private static EscenarioSimulacion[] Escenarios() =>
    [
        new(1, "FAVORABLE",    0.01m, 0.025m, 0.001m, 0.002m),
        new(2, "MODERADO",     0.025m, 0.05m, 0.002m, 0.004m),
        new(3, "DESFAVORABLE", 0.05m, 0.10m, 0.004m, 0.008m)
    ];

    private static JsonElement BuildPayload(TenenciasSimulacionData tenencias, int tMeses = 12)
    {
        var snapshots = new List<InstrumentoSimulacionSnapshot>();
        var payload   = MotorPayloadBuilder.Build(tenencias, Escenarios(), tMeses, 4242L, Today, snapshots);
        var json      = JsonSerializer.Serialize(payload);
        return JsonSerializer.Deserialize<JsonElement>(json);
    }

    // ── Accion ────────────────────────────────────────────────────────────────

    [Fact]
    public void BuildPayload_Accion_CamposCorrectos()
    {
        var tenencias = new TenenciasSimulacionData(
            [new AccionTenenciaSimulacion(5, "AAPL", 10m, 180m, 0.15m, 0.30m, 0.60m)],
            [], [], []);

        var payload = BuildPayload(tenencias);

        var inst = payload.GetProperty("instrumentos")[0];
        inst.GetProperty("id").GetString().Should().Be("accion_5");
        inst.GetProperty("tipo").GetString().Should().Be("accion");
        inst.GetProperty("monto").GetDouble().Should().BeApproximately(1800.0, 0.001);
        inst.GetProperty("mu").GetDouble().Should().BeApproximately(0.15, 0.001);
        inst.GetProperty("sigma").GetDouble().Should().BeApproximately(0.30, 0.001);
        inst.GetProperty("rho").GetDouble().Should().BeApproximately(0.60, 0.001);
    }

    // ── Letra ─────────────────────────────────────────────────────────────────

    [Fact]
    public void BuildPayload_Lecap_CamposCorrectos()
    {
        var venc = new DateOnly(2026, 12, 1);
        var tenencias = new TenenciasSimulacionData(
            [],
            [],
            [new LetraTenenciaSimulacion(7, "lecap", 100m, 98m, 0.50m, venc)],
            []);

        var payload = BuildPayload(tenencias);

        var inst = payload.GetProperty("instrumentos")[0];
        inst.GetProperty("id").GetString().Should().Be("letra_7");
        inst.GetProperty("tipo").GetString().Should().Be("lecap");
        inst.GetProperty("tna").GetDouble().Should().BeApproximately(0.50, 0.001);
        inst.GetProperty("t_venc_meses").GetInt32().Should().Be(5); // Jul→Dec = 5 months
    }

    // ── Bono ─────────────────────────────────────────────────────────────────

    [Fact]
    public void BuildPayload_BonoTasaFija_FlujosFuturos_MesRelativo()
    {
        var flujos = new List<FlujoSimulacion>
        {
            new(new DateOnly(2026, 10, 1), 420.5m, 4400m)
        };
        // flujo_bono está normalizado a un lote de VN 100; con Cantidad=2 lotes, el flujo
        // pasado al motor debe escalar 2x para quedar en la misma unidad que `monto`.
        var bono = new BonoTenenciaSimulacion(3, "AL30", "bono_tasa_fija", 2m, 4600m, 0.55m, flujos);
        var tenencias = new TenenciasSimulacionData([], [bono], [], []);

        var payload = BuildPayload(tenencias);

        var inst   = payload.GetProperty("instrumentos")[0];
        var flujo0 = inst.GetProperty("flujos")[0];
        flujo0.GetProperty("mes").GetInt32().Should().Be(3); // Jul→Oct = 3 months
        flujo0.GetProperty("monto").GetDouble().Should().BeApproximately(9641.0, 0.001); // (420.5+4400) * 2
    }

    [Fact]
    public void BuildPayload_BonoTasaFija_FlujoPasado_Excluido()
    {
        var flujos = new List<FlujoSimulacion>
        {
            new(new DateOnly(2026, 6, 1), 100m, 500m),  // past
            new(new DateOnly(2026, 10, 1), 200m, 1000m) // future
        };
        var bono = new BonoTenenciaSimulacion(3, "AL30", "bono_tasa_fija", 1m, 5000m, 0.55m, flujos);
        var tenencias = new TenenciasSimulacionData([], [bono], [], []);

        var payload = BuildPayload(tenencias);

        var flujoArray = payload.GetProperty("instrumentos")[0].GetProperty("flujos");
        flujoArray.GetArrayLength().Should().Be(1);
        flujoArray[0].GetProperty("mes").GetInt32().Should().Be(3);
    }

    // ── PlazoFijo ─────────────────────────────────────────────────────────────

    [Fact]
    public void BuildPayload_PlazoFijoTradicional_MonedaARS_TipoCorrecto()
    {
        var pf = new PlazoFijoTenenciaSimulacion(
            101, "TRADICIONAL", "ARS", 500_000m, 0.42m,
            new DateOnly(2026, 5, 1), 2, false);
        var tenencias = new TenenciasSimulacionData([], [], [], [pf]);

        var payload = BuildPayload(tenencias);

        var inst = payload.GetProperty("instrumentos")[0];
        inst.GetProperty("tipo").GetString().Should().Be("plazo_fijo_tradicional");
        inst.GetProperty("tna").GetDouble().Should().BeApproximately(0.42, 0.001);
    }

    [Fact]
    public void BuildPayload_PlazoFijoTradicional_MonedaUSD_TipoEsPlazoFijoUsd()
    {
        var pf = new PlazoFijoTenenciaSimulacion(
            103, "TRADICIONAL", "USD", 5000m, 0.05m,
            new DateOnly(2026, 1, 1), 6, false);
        var tenencias = new TenenciasSimulacionData([], [], [], [pf]);

        var payload = BuildPayload(tenencias);

        payload.GetProperty("instrumentos")[0]
            .GetProperty("tipo").GetString().Should().Be("plazo_fijo_usd");
    }

    [Fact]
    public void BuildPayload_PlazoFijoUVA_TasaRealAnual_EsTnaPactada()
    {
        var pf = new PlazoFijoTenenciaSimulacion(
            102, "UVA", "ARS", 100_000m, 0.08m,
            new DateOnly(2026, 3, 1), 4, true);
        var tenencias = new TenenciasSimulacionData([], [], [], [pf]);

        var payload = BuildPayload(tenencias);

        var inst = payload.GetProperty("instrumentos")[0];
        inst.GetProperty("tipo").GetString().Should().Be("plazo_fijo_uva");
        inst.GetProperty("tasa_real_anual").GetDouble().Should().BeApproximately(0.08, 0.001);
    }

    // ── Escenarios ────────────────────────────────────────────────────────────

    [Fact]
    public void BuildPayload_EscenariosLowercase_ClavesCorrectas()
    {
        var tenencias = new TenenciasSimulacionData([], [], [], []);
        var snapshots = new List<InstrumentoSimulacionSnapshot>();
        var payload   = MotorPayloadBuilder.Build(tenencias, Escenarios(), 12, 4242L, Today, snapshots);
        var json      = JsonSerializer.Serialize(payload);
        var el        = JsonSerializer.Deserialize<JsonElement>(json);

        var esc = el.GetProperty("escenarios");
        esc.TryGetProperty("favorable", out _).Should().BeTrue();
        esc.TryGetProperty("moderado", out _).Should().BeTrue();
        esc.TryGetProperty("desfavorable", out _).Should().BeTrue();
    }
}
