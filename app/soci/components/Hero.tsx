import { Badge } from './Badge';

export function Hero() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl px-6 py-12 text-white sm:px-12 sm:py-16"
      style={{ background: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 50%, #0ea5e9 100%)' }}
    >
      <div
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            'radial-gradient(circle at 75% 30%, #10b981 0%, transparent 45%), radial-gradient(circle at 15% 80%, #8b5cf6 0%, transparent 40%)',
        }}
      />
      <div className="relative">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge variant="warning">Podmíněné GO</Badge>
          <span className="text-sm text-sky-200">Potvrdit: Camp Bovec + rafting firma</span>
        </div>
        <h1 className="mb-1 text-4xl font-extrabold tracking-tight sm:text-5xl">Soča Classic</h1>
        <p className="mb-3 text-xl font-semibold text-sky-200">Bovec basecamp</p>
        <p className="mb-6 max-w-xl text-lg text-sky-100">
          Jedna základna. Denní výlety nalehko. Smaragdová řeka, vodopády, Vršič a rafting — bez batohu na zádech.
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-sky-200">
          {[
            ['4.–11. 7. 2026', '#7dd3fc'],
            ['7 dní', '#6ee7b7'],
            ['bez auta', '#fde68a'],
            ['rafting + canyoning', '#c4b5fd'],
            ['Slovinsko', '#94a3b8'],
          ].map(([label, color]) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
              {label}
            </span>
          ))}
        </div>
        <p className="mt-4 text-sm text-sky-300">Táta + synové (20 a 16 let) · vlak/bus z Brna</p>
      </div>
    </div>
  );
}
