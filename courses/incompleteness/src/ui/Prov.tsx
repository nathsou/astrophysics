// Provenance: every piece of content says what it is.

export type ProvKind = 'book' | 'added' | 'computed' | 'checked' | 'theorem' | 'failed';

const LABEL: Record<ProvKind, string> = {
  book: 'Open Logic text',
  added: 'Added',
  computed: 'Computed',
  checked: 'Checked',
  theorem: 'Theorem',
  failed: 'Rejected',
};

const TITLE: Record<ProvKind, string> = {
  book: 'Text from Incompleteness and Computability (Open Logic Project, CC BY 4.0), converted from the LaTeX source.',
  added: 'Written for this edition; not part of the original text.',
  computed: 'Computed by the course’s engine for this particular input. A computed example illustrates a result; it does not prove it.',
  checked: 'Every inference was verified by the natural deduction checker. It is a derivation of this particular sentence, not a proof of the general theorem.',
  theorem: 'A general result, proved in the text for all cases.',
  failed: 'The checker rejected this step.',
};

const ICON: Record<ProvKind, string> = { book: '¶', added: '✎', computed: '⚙', checked: '✓', theorem: '∀', failed: '✗' };

export function Prov({ kind, children, title }: { kind: ProvKind; children?: React.ReactNode; title?: string }) {
  return (
    <span className={`prov ${kind}`} title={title ?? TITLE[kind]}>
      <span aria-hidden="true">{ICON[kind]}</span>
      {children ?? LABEL[kind]}
    </span>
  );
}

export function ProvLegend() {
  return (
    <ul className="legend sans">
      {(['computed', 'checked', 'theorem'] as ProvKind[]).map((k) => (
        <li key={k}>
          <Prov kind={k} /> <span>{TITLE[k]}</span>
        </li>
      ))}
    </ul>
  );
}

/** A set-off block: a section's summary, or a panel attached to the text. A generic label
 *  (“Added for this edition”) is not shown; a descriptive one becomes the block's heading. */
export function Added({ children, label }: { children: React.ReactNode; label?: string }) {
  const heading = label?.replace(/^(a note )?added for this edition(:\s*)?/i, '').trim();
  return (
    <div className="added-block">
      {heading && <div className="added-kicker">{heading.charAt(0).toUpperCase() + heading.slice(1)}</div>}
      {children}
    </div>
  );
}

/** A reminder that a finite check is not a proof. */
export function NotAProof({ children }: { children?: React.ReactNode }) {
  return (
    <p className="caveat">
      <strong>An instance, not a proof.</strong>{' '}
      {children ?? 'This checks one case. The general statement is proved in the text by an argument that covers every case.'}
    </p>
  );
}
