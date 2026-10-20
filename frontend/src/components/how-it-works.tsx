const STEPS = [
  {
    title: "Dê um nome",
    description: "Crie uma playlist em segundos. Um nome basta para começar.",
  },
  {
    title: "Escolha a cor",
    description: "Use uma das paletas prontas ou defina a sua própria cor.",
  },
  {
    title: "Aperte o play",
    description: "Organize as faixas, busque o que quiser e ouça do seu jeito.",
  },
];

export default function HowItWorks() {
  return (
    <section id="como-funciona" data-header-theme="dark" className="scroll-mt-16 bg-ink text-paper">
      <div className="mx-auto max-w-6xl px-6 py-24 md:px-8 md:py-32">
        <span className="mb-3 block text-[11px] font-mono uppercase tracking-widest text-paper/60">
          Como funciona
        </span>
        <h2 className="mb-16 max-w-2xl text-4xl font-black leading-[0.95] tracking-tight sm:text-6xl">
          Três passos até a sua próxima obsessão.
        </h2>

        <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
          {STEPS.map((step, idx) => (
            <li key={step.title} className="relative border-t border-paper/20 pt-8">
              <span className="absolute -top-px left-0 h-px w-12 bg-primary" />
              <span className="mb-6 block text-6xl font-black text-primary">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <h3 className="mb-3 text-2xl font-bold tracking-tight">{step.title}</h3>
              <p className="text-sm leading-relaxed text-paper/70">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
