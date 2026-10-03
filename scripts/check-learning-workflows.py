#!/usr/bin/env python3
"""Regression smoke checks against `npm run build` served over HTTP.

Requires Python Playwright and Chromium. Example:
  python3 -m http.server 8000 --bind 127.0.0.1 -d dist
  python3 scripts/check-learning-workflows.py http://127.0.0.1:8000
Set CHROMIUM_PATH when Chromium is not at /usr/bin/chromium.
"""
import os
import sys
from playwright.sync_api import sync_playwright, expect

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8000').rstrip('/')


def edit(page, container, source):
    editor = container.locator('.cm-content').first
    editor.click()
    page.keyboard.press('ControlOrMeta+A')
    page.keyboard.insert_text(source)


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), args=['--no-sandbox', '--disable-dev-shm-usage'])
    context = browser.new_context(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce')
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE + '/proofs-are-programs/#/ch/prologue')
    exercise = page.locator('.callout.exercise').last
    bad = 'def compose : Nat := 0\ndef swap : Nat := 0'
    edit(page, exercise, bad)
    expect(exercise.get_by_role('status')).to_contain_text('requested type')
    assert 'Kernel checked' not in exercise.inner_text()
    good = 'def compose {α β γ : Type} : (α → β) → (β → γ) → α → γ := fun f g x => g (f x)\ndef swap {α β : Type} : α × β → β × α := fun p => (p.2, p.1)'
    edit(page, exercise, good)
    expect(exercise.locator('.badge').first).to_have_text('✓ Kernel checked')
    page.reload()
    expect(exercise.locator('.cm-content').first).to_contain_text('fun f g x')
    edit(page, exercise, bad)
    expect(exercise.locator('.badge').first).to_have_text('Previously completed')
    expect(exercise.get_by_role('status')).to_contain_text('requested type')
    page.reload()
    expect(exercise.locator('.cm-content').first).to_contain_text('def compose : Nat := 0')
    print('PASS proof contracts, edit-after-pass and draft reload', flush=True)

    page.goto(BASE + '/proofs-are-programs/#/ch/programs')
    exercise = page.locator('.callout.exercise').filter(has_text='Zipping two lists')
    edit(page, exercise, 'def zip {α β : Type} : List α → List β → List (α × β) := fun xs ys => []')
    expect(exercise.get_by_role('status')).to_contain_text('example assertion')
    print('PASS protected examples cannot be deleted to bypass grading', flush=True)

    page.goto(BASE + '/language-models/chapters/what-is-a-language-model/')
    exercise = page.locator('section.exercise').first
    edit(page, exercise, 'export function mostLikely(probs: number[]): number { let best = 0; for (let i = 1; i < probs.length; i++) if (probs[i] > probs[best]) best = i; return best; }')
    exercise.get_by_role('button', name='Run tests').click()
    expect(exercise.locator('.yay')).to_contain_text('All tests pass', timeout=30000)
    expect(exercise.get_by_role('switch')).to_be_enabled()
    edit(page, exercise, 'export function mostLikely(probs: number[]): number { return 0; }')
    expect(exercise.get_by_role('switch')).to_be_disabled()
    expect(exercise.locator('.results')).to_have_count(0)
    page.reload()
    expect(exercise.locator('.cm-content').first).to_contain_text('return 0')
    expect(exercise.get_by_role('switch')).to_be_disabled()
    print('PASS language-model test invalidation and restored-code gate', flush=True)

    page.goto(BASE + '/incompleteness/#/s/inc.inp.1in?mode=formal')
    page.get_by_role('tab', name='Formal', exact=True).click()
    page.locator('nav.pager a').filter(has_text='Next').click()
    expect(page.get_by_role('tab', name='Formal', exact=True)).to_have_attribute('aria-selected', 'true')
    page.goto(BASE + '/incompleteness/')
    expect(page.locator('details.home-chapter').first).to_be_visible()
    assert page.locator('details.home-chapter[open]').count() == 0
    print('PASS preferred mode and collapsed contents', flush=True)

    page.goto(BASE + '/proofs/chapters/what-is-a-proof/')
    zoom = page.locator('.zoom').first
    zoom.get_by_role('tab', name='Proof', exact=True).click()
    page.reload()
    expect(zoom.get_by_role('tab', name='Proof', exact=True)).to_have_attribute('aria-selected', 'true')
    quiz = page.locator('fieldset.quiz').first
    quiz.locator('input[type=radio]').first.check()
    expect(quiz.locator('.feedback')).to_have_count(0)
    quiz.get_by_role('button', name='Check answer', exact=True).click()
    expect(quiz.locator('.feedback')).to_have_count(1)
    quiz.get_by_role('button', name='Try again', exact=True).click()
    expect(quiz.locator('.feedback')).to_have_count(0)
    print('PASS proof detail preference and deliberate quiz feedback', flush=True)

    page.goto(BASE + '/compiler-backends/#/ch/intro')
    term = page.locator('button.term').first
    term.focus()
    expect(page.get_by_role('tooltip')).to_be_visible()
    page.keyboard.press('Escape')
    expect(page.get_by_role('tooltip')).to_have_count(0)
    listing = page.locator('.code[tabindex="0"]').first
    listing.focus()
    page.keyboard.press('ArrowDown')
    print('PASS keyboard glossary and instruction inspection', flush=True)

    page.goto(BASE + '/particle-physics/chapters/quantum-essentials/')
    guide = page.get_by_role('navigation', name='Reading checkpoints')
    expect(guide).to_be_visible()
    guide.locator('summary').click()
    checkpoint = guide.locator('li button').nth(2)
    label = checkpoint.inner_text()
    checkpoint.click()
    page.wait_for_timeout(150)
    page.reload()
    expect(guide.get_by_role('button', name='Resume: ' + label, exact=True)).to_be_visible()
    assert page.locator('.coding-choice:not([open])').count() > 0
    print('PASS section bookmarks and optional project disclosure', flush=True)

    page.goto(BASE + '/elements/#/1.1')
    expect(page.get_by_label('Time per proof step')).to_have_value('6000')
    page.get_by_label('Time per proof step').select_option('12000')
    print('PASS adjustable proof playback', flush=True)

    for course, route in [
        ('astrophysics', '/ch/scales/'), ('cic', '/#/ch/lambda'),
        ('proofs-are-programs', '/#/ch/prologue'), ('compiler-backends', '/#/ch/intro'),
        ('incompleteness', '/'), ('elements', '/'),
        ('language-models', '/chapters/text-as-data/'), ('proofs', '/chapters/what-is-a-proof/'),
        ('digital-circuits', '/chapters/cmos/'), ('particle-physics', '/chapters/quantum-essentials/'),
        ('mandarin', '/learn/06-hello/'),
    ]:
        page.set_viewport_size({'width': 390, 'height': 900})
        page.goto(BASE + '/' + course + route)
        page.wait_for_timeout(700)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), course + ' overflows'
    assert not errors, errors
    print('PASS mobile layout across all eleven courses; no uncaught page errors', flush=True)
    context.close()
    browser.close()
