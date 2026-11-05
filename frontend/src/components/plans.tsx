import Link from "next/link"
import { buttonVariants } from "./ui/button"
import { describePlanSize, formatPlanPrice, PLAN_TYPES } from "@/lib/subscription/rules"
import { cn } from "@/lib/utils"

// The two plans, for whoever is still deciding: price, how many people and what comes with it.
// Subscribing itself happens on /planos, which also asks a visitor to create an account first.
export default function Plans() {
  return (
    <section id="planos" className="scroll-mt-16 bg-background">
      <div className="mx-auto max-w-6xl px-6 py-24 md:px-8 md:py-32">
        <span className="mb-4 block font-mono text-xs text-muted-foreground">Planos</span>
        <h2 className="max-w-2xl text-4xl leading-[1.05] font-medium tracking-[-0.03em] sm:text-6xl">
          Sozinho ou com a família
        </h2>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Os dois planos dão acesso a todo o catálogo. Dá para cancelar quando quiser.
        </p>

        <ul className="mt-16 grid gap-6 md:grid-cols-2">
          {PLAN_TYPES.map((plan) => (
            <li key={plan.id} className="flex flex-col border-t border-ink/10 pt-8">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-2xl font-medium tracking-[-0.02em]">{plan.name}</h3>
                <span className="font-mono text-xs text-muted-foreground">{describePlanSize(plan)}</span>
              </div>
              <p className="mt-4">
                <span className="text-4xl font-medium tabular-nums tracking-[-0.03em]">{formatPlanPrice(plan.price)}</span>
                <span className="text-sm text-muted-foreground"> /mês</span>
              </p>
              <ul className="mt-6 flex-1 space-y-2 text-sm text-muted-foreground">
                {plan.perks.map((perk) => (
                  <li key={perk} className="flex gap-2">
                    <span aria-hidden="true" className="text-primary">
                      ✓
                    </span>
                    {perk}
                  </li>
                ))}
              </ul>
              <Link href="/planos" className={cn(buttonVariants({ size: "lg" }), "mt-8 h-11 self-start px-5 text-sm")}>
                Assinar o {plan.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
