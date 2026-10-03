/** Keep a non-modal word card within the visible viewport, including short mobile screens. */
export function wordCardPosition(anchor: Pick<DOMRect, 'left' | 'width' | 'top' | 'bottom'>, card: { width: number; height: number }, viewport: { width: number; height: number }) {
  const margin = 8;
  const above = anchor.bottom + card.height + 10 > viewport.height - margin && anchor.top - card.height - 10 >= margin;
  return {
    left: Math.max(margin, Math.min(viewport.width - card.width - margin, anchor.left + anchor.width / 2 - card.width / 2)),
    top: Math.max(margin, Math.min(viewport.height - card.height - margin, above ? anchor.top - card.height - 10 : anchor.bottom + 10)),
  };
}
