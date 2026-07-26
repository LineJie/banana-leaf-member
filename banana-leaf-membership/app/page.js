import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-leaf-950 relative overflow-hidden flex items-center justify-center px-4 py-10 sm:px-6 sm:py-16">
      <svg
        className="absolute -right-24 -top-24 w-[520px] h-[520px] opacity-[0.12] text-leaf-100"
        viewBox="0 0 200 200"
        fill="none"
      >
        <path
          d="M100 10 C40 10 15 55 15 100 C15 150 45 190 100 190 C100 140 100 60 100 10 Z"
          stroke="currentColor"
          strokeWidth="1"
        />
        {Array.from({ length: 9 }).map((_, i) => (
          <path
            key={i}
            d={`M100 ${30 + i * 16} C70 ${34 + i * 16} 45 ${40 + i * 16} 28 ${48 + i * 16}`}
            stroke="currentColor"
            strokeWidth="0.75"
          />
        ))}
      </svg>

      <div className="relative w-full max-w-3xl">
        <div className="mb-12 text-center">
          <img
            src="/logo-banana-leaf.png"
            alt="Banana Leaf"
            className="mx-auto w-[420px] max-w-full h-auto mb-4"
          />
          <h1 className="font-display text-4xl sm:text-5xl text-leaf-50 leading-tight">
            Membership &amp; Poin
          </h1>
          <p className="font-body text-leaf-200/70 mt-3 max-w-md mx-auto">
            Rp100.000 belanja = 1 poin. Poin berlaku 90 hari sejak didapat.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <Link
            href="/member/login"
            className="focus-ring group rounded-2xl bg-leaf-900/60 border border-leaf-700/50 p-8 hover:bg-leaf-900 hover:border-gold-400/60 transition-colors"
          >
            <span className="block font-display text-2xl text-leaf-50 mb-2">Member</span>
            <span className="block font-body text-sm text-leaf-200/70 mb-6">
              Login pakai nomor WhatsApp buat cek poin kamu
            </span>
            <span className="inline-flex items-center gap-2 font-body text-sm text-gold-300 group-hover:text-gold-200">
              Cek poin saya
              <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
                →
              </span>
            </span>
          </Link>

          <Link
            href="/staff/login"
            className="focus-ring group rounded-2xl bg-leaf-900/60 border border-leaf-700/50 p-8 hover:bg-leaf-900 hover:border-gold-400/60 transition-colors"
          >
            <span className="block font-display text-2xl text-leaf-50 mb-2">Staff</span>
            <span className="block font-body text-sm text-leaf-200/70 mb-6">
              Catat belanja, tambah member baru, proses redeem poin
            </span>
            <span className="inline-flex items-center gap-2 font-body text-sm text-gold-300 group-hover:text-gold-200">
              Masuk dashboard
              <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
                →
              </span>
            </span>
          </Link>
        </div>
      </div>
    </main>
  );
}
