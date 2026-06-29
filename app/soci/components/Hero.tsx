import { Badge } from './Badge';

export function Hero() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 px-6 py-12 text-white sm:px-12 sm:py-16">
      <div className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 50%, #0ea5e9 0%, transparent 50%), radial-gradient(circle at 80% 20%, #10b981 0%, transparent 40%)',
        }}
      />
      <div className="relative">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge variant="warning">Podmíněné GO</Badge>
          <span className="text-sm text-slate-400">Potvrdit: Trenta + rafting</span>
        </div>
        <h1 className="mb-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
          Soča Classic
        </h1>
        <p className="mb-6 max-w-xl text-lg text-slate-300">
          Alpský trek, smaragdová Soča a společné dobrodružství bez auta.
        </p>
        <div className="mb-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            4.–11. 7. 2026
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            7 dní
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
            bez auta
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
            trek + rafting
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Slovinsko
          </span>
        </div>
        <p className="text-sm text-slate-500">
          Táta + synové (20 a 16 let) · vlak/bus · Julské Alpy
        </p>
      </div>
    </div>
  );
}
