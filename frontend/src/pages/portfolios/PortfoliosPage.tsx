export default function PortfoliosPage() {
  // TODO: replace with useQuery when API is wired
  const portfolios: unknown[] = []

  if (portfolios.length === 0) return <BienvenidaView />
  return <div>Lista de portfolios</div>
}

function BienvenidaView() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h1 className="text-2xl font-semibold text-navy-950">
        Bienvenida a InvestLab
      </h1>
      <p className="text-muted-foreground text-center max-w-sm">
        Todavía no tenés portfolios. Creá uno para empezar a simular estrategias
        de inversión.
      </p>
      {/* TODO: open create-portfolio dialog */}
      <button className="bg-navy-950 text-white px-4 py-2 rounded-md text-sm">
        Crear mi primer portfolio
      </button>
    </div>
  )
}
