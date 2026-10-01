/**
 * Light/dark theme toggle. `system` follows prefers-color-scheme. The choice is stored under the
 * `theme` key that every course in the collection shares, so it carries across courses and tabs.
 */

export type ThemeChoice = 'system' | 'light' | 'dark';
/** The page colour in the light theme: the warm default, or plain white. */
export type PaperChoice = 'default' | 'white';

function read(): ThemeChoice {
  try {
    const t = localStorage.getItem('theme');
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

function readPaper(): PaperChoice {
  try {
    return localStorage.getItem('paper') === 'white' ? 'white' : 'default';
  } catch {
    return 'default';
  }
}

class Theme {
  choice: ThemeChoice = $state('system');
  paper: PaperChoice = $state('default');
  /** The theme actually shown (resolves `system`). */
  resolved: 'light' | 'dark' = $state('light');

  init(): void {
    this.choice = read();
    this.paper = readPaper();
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const update = () => {
      this.resolved = this.choice === 'system' ? (mq.matches ? 'dark' : 'light') : this.choice;
    };
    mq.addEventListener('change', update);
    update();
    // Another tab (or another course) changed the shared preference.
    addEventListener('storage', (e: StorageEvent) => {
      if (e.key === 'paper') {
        this.paper = readPaper();
        this.applyPaper();
        return;
      }
      if (e.key !== 'theme') return;
      this.choice = read();
      if (this.choice === 'system') delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = this.choice;
      update();
    });
  }

  set(choice: ThemeChoice): void {
    this.choice = choice;
    try {
      if (choice === 'system') localStorage.removeItem('theme');
      else localStorage.setItem('theme', choice);
    } catch {
      /* storage unavailable: theme still applies for this page view */
    }
    if (choice === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = choice;
    this.resolved = choice === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : choice;
  }

  setPaper(paper: PaperChoice): void {
    this.paper = paper;
    try {
      if (paper === 'white') localStorage.setItem('paper', 'white');
      else localStorage.removeItem('paper');
    } catch {
      /* storage unavailable: the choice still applies for this page view */
    }
    this.applyPaper();
  }

  private applyPaper(): void {
    if (this.paper === 'white') document.documentElement.dataset.paper = 'white';
    else delete document.documentElement.dataset.paper;
  }

  cycle(): void {
    this.set(this.choice === 'system' ? (this.resolved === 'dark' ? 'light' : 'dark') : this.choice === 'dark' ? 'light' : 'system');
  }
}

export const theme = new Theme();
