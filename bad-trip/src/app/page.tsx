import Link from "next/link";
import { Navbar } from "@/components/Navbar";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4">
        <section className="py-20 text-center">
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">
            Balance tes idées de voyage,{" "}
            <span className="text-accent">l&apos;IA trace la route.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
            Dépose des textes, des images et des documents trouvés sur le net.
            Bad&apos;Trip les analyse et construit un itinéraire jour par jour,
            sur une carte. En solo ou à plusieurs, entre amis.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href="/signup" className="btn-primary px-6 py-3 text-base">
              Commencer gratuitement
            </Link>
            <Link href="/login" className="btn-ghost px-6 py-3 text-base">
              J&apos;ai déjà un compte
            </Link>
          </div>
        </section>

        <section className="grid gap-4 pb-20 sm:grid-cols-3">
          {[
            {
              t: "1. Dépose",
              d: "Textes, photos de lieux, PDF, articles de blog… tout ce que tu as trouvé.",
            },
            {
              t: "2. L'IA analyse",
              d: "Elle repère les lieux, les regroupe par journée et propose un parcours cohérent.",
            },
            {
              t: "3. À plusieurs",
              d: "Invite tes amis dans le projet et construisez le voyage ensemble.",
            },
          ].map((f) => (
            <div key={f.t} className="card">
              <h3 className="text-lg font-semibold text-accentSoft">{f.t}</h3>
              <p className="mt-2 text-sm text-slate-300">{f.d}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
