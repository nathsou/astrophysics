// A row of options with a thumb that slides to the selected one (the text switch of the proposition
// page, the view switches of the graph).

interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  small?: boolean;
}

export function Switch<T extends string>({ options, value, onChange, label, small }: Props<T>) {
  const i = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className={`switch ${small ? 'small' : ''}`} role="tablist" aria-label={label} style={{ '--n': options.length, '--i': i } as React.CSSProperties}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
