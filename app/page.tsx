export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white mb-6">
            Trading Bot SaaS
          </h1>
          <p className="text-xl text-slate-300 mb-8">
            Automatiza tu trading con backtesting avanzado
          </p>
          <div className="flex gap-4 justify-center">
            <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              Comenzar Gratis
            </button>
            <button className="px-6 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition">
              Ver Demo
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mt-16">
          <div className="bg-slate-800 p-6 rounded-lg">
            <h3 className="text-xl font-semibold text-white mb-2">Backtesting</h3>
            <p className="text-slate-300">
              Analiza 25,000+ señales históricas para optimizar tu estrategia
            </p>
          </div>
          <div className="bg-slate-800 p-6 rounded-lg">
            <h3 className="text-xl font-semibold text-white mb-2">Automatización</h3>
            <p className="text-slate-300">
              Ejecuta operaciones automáticamente 24/7 en tu cuenta MT5
            </p>
          </div>
          <div className="bg-slate-800 p-6 rounded-lg">
            <h3 className="text-xl font-semibold text-white mb-2">Multi-tenant</h3>
            <p className="text-slate-300">
              Gestiona múltiples cuentas de trading desde un solo dashboard
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
