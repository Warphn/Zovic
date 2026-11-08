const STEPS = [
  {
    title: "Crie sua conta",
    description: "Nome, e-mail, senha e data de nascimento. Em um minuto você está dentro.",
  },
  {
    title: "Busque e aperte o play",
    description: "Encontre uma faixa, um artista ou um gênero e comece a ouvir na hora.",
  },
  {
    title: "Guarde o que é seu",
    description: "Junte as faixas numa playlist, escolha a cor do encarte e arraste na ordem que quiser.",
  },
];

export default function HowItWorks() {
  return (
    <section id="como-funciona" data-header-theme="dark" className="scroll-mt-16 bg-ink text-paper">
      <div className="mx-auto max-w-6xl px-6 py-24 md:px-8 md:py-32">
        <span className="mb-4 block font-mono text-xs text-paper/60">
          Como funciona
        </span>
        <h2 className="mb-16 max-w-2xl text-4xl leading-[1.05] font-medium tracking-[-0.03em] sm:text-6xl">
          Do cadastro à sua primeira playlist
        </h2>

        <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
          {STEPS.map((step, idx) => (
            <li key={step.title} className="relative border-t border-paper/20 pt-8">
              <span className="absolute -top-px left-0 h-px w-12 bg-primary" />
              <span className="mb-6 block font-mono text-sm text-paper/60 tabular-nums">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <h3 className="mb-3 text-2xl font-medium tracking-[-0.02em]">{step.title}</h3>
              <p className="text-sm leading-relaxed text-paper/70">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
