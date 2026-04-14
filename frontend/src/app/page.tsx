import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Mic, Sparkles, FileText } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Scribe House Logo"
              width={48}
              height={48}
              className="h-12 w-12"
            />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link href="/register">
              <Button>Get Started</Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
            Transform Your Voice into
            <span className="text-primary"> Beautiful Books</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Record your stories, memories, or ideas. Our AI transforms your voice recordings
            into professionally formatted books, ready for publishing.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="gap-2">
                <Mic className="h-5 w-5" />
                Start Recording
              </Button>
            </Link>
            <Link href="#features">
              <Button size="lg" variant="outline">
                Learn More
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Section */}
        <section id="features" className="mt-32">
          <h2 className="text-center text-3xl font-bold">How It Works</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <FeatureCard
              icon={<Mic className="h-10 w-10" />}
              title="Record or Upload"
              description="Record audio directly in your browser or upload existing recordings. We support MP3, WAV, M4A, and more."
            />
            <FeatureCard
              icon={<Sparkles className="h-10 w-10" />}
              title="AI Processing"
              description="Our AI transcribes your audio, extracts narrative events, and organizes them into coherent chapters."
            />
            <FeatureCard
              icon={<FileText className="h-10 w-10" />}
              title="Export Your Book"
              description="Export your finished book as PDF, EPUB, DOCX, or Markdown. Ready for publishing or personal use."
            />
          </div>
        </section>

        {/* Stats Section */}
        <section className="mt-32 rounded-2xl bg-primary/5 p-12">
          <div className="grid gap-8 text-center md:grid-cols-3">
            <StatCard value="100+" label="Books Created" />
            <StatCard value="50k+" label="Hours Transcribed" />
            <StatCard value="99%" label="Accuracy Rate" />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-12 text-center text-muted-foreground">
        <p>© 2024 Scribe House. All rights reserved.</p>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-6 text-center transition-shadow hover:shadow-lg">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mb-2 text-xl font-semibold">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-4xl font-bold text-primary">{value}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  );
}
