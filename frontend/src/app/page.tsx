import Header from "@/components/header";
import Hero from "@/components/hero";

export default function Home() {
  return (
    <div>
      <Header />
      <main className="flex min-h-screen flex-1">
        <Hero />
      </main>
    </div>
  );
}
