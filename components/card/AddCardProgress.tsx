type AddCardProgressProps = {
  steps: readonly string[];
  currentStep: number;
};

export default function AddCardProgress({ steps, currentStep }: AddCardProgressProps) {
  return (
    <nav aria-label="Add card progress" className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold-primary)]">
          Step {currentStep + 1} of {steps.length}
        </p>
        <p className="text-sm font-semibold text-[var(--text-primary)]">{steps[currentStep]}</p>
      </div>
      <ol className="grid grid-cols-6 gap-2">
        {steps.map((step, index) => (
          <li key={step}>
            <span className="sr-only">{step}</span>
            <span
              aria-current={index === currentStep ? "step" : undefined}
              className={`block h-1 rounded-full transition-colors duration-200 ${
                index <= currentStep ? "bg-[var(--gold-primary)]" : "bg-[var(--border-subtle)]"
              }`}
            />
          </li>
        ))}
      </ol>
    </nav>
  );
}
