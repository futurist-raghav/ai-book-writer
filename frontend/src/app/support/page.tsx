import Link from 'next/link';

export default function SupportPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 pt-16 pb-24">
      <h1 className="text-5xl md:text-6xl font-light tracking-tighter text-primary font-body mb-3">Support</h1>
      <p className="font-label text-sm text-on-surface-variant mb-10">
        Need help with Scribe House? Reach out through project issues or internal support channels.
      </p>

      <section className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/10 space-y-3">
        <p className="font-label text-sm text-on-surface">1. Check setup and deployment docs for environment and service troubleshooting.</p>
        <p className="font-label text-sm text-on-surface">2. Reproduce the issue from the relevant dashboard area (Projects, Chapters, Audio, Events) and capture exact steps.</p>
        <p className="font-label text-sm text-on-surface">3. Open an issue with reproduction steps and key logs if the problem persists.</p>

        <div className="pt-4 grid gap-2 sm:grid-cols-2">
          <Link href="/dashboard/books" className="rounded-lg border border-outline-variant/20 px-4 py-3 text-sm font-label text-primary hover:bg-surface-container-low transition-colors">
            Open Projects
          </Link>
          <Link href="/dashboard/chapters" className="rounded-lg border border-outline-variant/20 px-4 py-3 text-sm font-label text-primary hover:bg-surface-container-low transition-colors">
            Open Chapters
          </Link>
          <Link href="/dashboard/events" className="rounded-lg border border-outline-variant/20 px-4 py-3 text-sm font-label text-primary hover:bg-surface-container-low transition-colors">
            Open Events
          </Link>
          <Link href="/dashboard/settings" className="rounded-lg border border-outline-variant/20 px-4 py-3 text-sm font-label text-primary hover:bg-surface-container-low transition-colors">
            Account Settings
          </Link>
        </div>
      </section>
    </main>
  );
}
