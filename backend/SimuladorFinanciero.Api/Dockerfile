# Build context esperado: backend/SimuladorFinanciero.Api

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY SimuladorFinanciero.Api.csproj ./
RUN dotnet restore ./SimuladorFinanciero.Api.csproj

COPY . .
RUN dotnet publish ./SimuladorFinanciero.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080

CMD ["sh", "-c", "ASPNETCORE_URLS=http://+:${PORT:-8080} dotnet SimuladorFinanciero.Api.dll"]
