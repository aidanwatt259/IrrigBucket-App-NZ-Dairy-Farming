import { ACCOUNT_TYPE_OPTIONS, type AccountType } from '@/lib/accountType';

export function AccountTypeChoice({
  value,
  onChange,
  disabled,
  compact,
}: {
  value: AccountType;
  onChange: (next: AccountType) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Account type" className="grid grid-cols-2 gap-2">
      {ACCOUNT_TYPE_OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`rounded-xl border text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              compact ? 'px-3 py-2' : 'px-3 py-2.5'
            } ${
              selected
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-border hover:bg-muted/50'
            }`}
          >
            <span className="block text-sm font-semibold text-foreground">{option.title}</span>
            {!compact && (
              <span className="block text-xs text-muted-foreground mt-0.5 leading-snug">
                {option.description}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
