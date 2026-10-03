/** The single word card shared by every piece of Chinese on the page. */
import type { Token } from '$lib/zh/annotate';

class WordPopover {
  token: Token | null = $state(null);
  anchor: DOMRect | null = $state(null);
  /** The element that opened the card, to return focus on close. */
  opener: HTMLElement | null = null;

  open(token: Token, el: HTMLElement): void {
    this.token = token;
    this.anchor = el.getBoundingClientRect();
    this.opener = el;
  }

  close(returnFocus = false): void {
    if (returnFocus) this.opener?.focus();
    this.token = null;
    this.anchor = null;
  }
}

export const popover = new WordPopover();
