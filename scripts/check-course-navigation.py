#!/usr/bin/env python3
"""Check course navigation against a built site served over HTTP.

Requires Python Playwright and Chromium, like check-learning-workflows.py:
  python3 scripts/check-course-navigation.py http://127.0.0.1:8000
Set CHROMIUM_PATH to override /usr/bin/chromium.
"""
import os
import sys
from playwright.sync_api import sync_playwright, expect

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8000').rstrip('/')
COURSES = ['astrophysics', 'cic', 'proofs-are-programs', 'compiler-backends',
           'incompleteness', 'elements', 'language-models', 'proofs',
           'digital-circuits', 'particle-physics']


with sync_playwright() as pw:
    browser = pw.chromium.launch(
        executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'),
        args=['--no-sandbox', '--disable-dev-shm-usage'])
    context = browser.new_context(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce')
    page = context.new_page()
    page.goto(BASE + '/')
    expect(page.locator('.grid .card')).to_have_count(10)
    expect(page.locator('.course-choice, .course-fit')).to_have_count(0)

    for course in COURSES:
        page.set_viewport_size({'width': 1440, 'height': 900})
        page.goto(f'{BASE}/{course}/')
        sidebar = page.locator('#course-contents')
        # The opener is in the course header or a drawer handle, outside the contents.
        opener = page.locator('[data-sidebar-toggle]').locator('xpath=self::*[not(ancestor::*[@id="course-contents"])]')
        closer = sidebar.locator('[data-sidebar-toggle]')
        expect(page.locator('.course-index-nav')).to_have_count(0)
        expect(closer).to_have_attribute('aria-expanded', 'true')
        expect(sidebar).to_be_visible()
        assert page.locator('.course-shell').bounding_box()['y'] < 65
        closer.click()
        expect(sidebar).to_be_hidden()
        expect(opener).to_be_focused()
        page.reload()
        expect(opener).to_have_attribute('aria-expanded', 'false')
        expect(sidebar).to_be_hidden()
        opener.click()
        expect(sidebar).to_be_visible()

        for width in [390, 844]:
            page.set_viewport_size({'width': width, 'height': 900})
            expect(sidebar).to_have_js_property('inert', True)
            opener.click()
            expect(closer).to_be_focused()
            expect(sidebar).to_have_js_property('inert', False)
            assert sidebar.bounding_box()['y'] == 0
            expect(page.locator('.course-shell > main, .course-shell > .main')).to_have_js_property('inert', True)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            # Tab and Shift+Tab wrap within the drawer even with the header outside it.
            page.evaluate('''() => {
                const nodes = [...document.querySelectorAll('#course-contents a[href], #course-contents button, #course-contents summary, #course-contents input')]
                    .filter(el => el.tabIndex >= 0 && !el.disabled && el.checkVisibility({visibilityProperty: true}));
                nodes.at(-1).focus();
            }''')
            page.keyboard.press('Tab')
            expect(sidebar.locator('.course-index-link')).to_be_focused()
            page.keyboard.press('Shift+Tab')
            assert page.evaluate('document.activeElement.closest("#course-contents") !== null')
            page.keyboard.press('Escape')
            expect(opener).to_be_focused()
            expect(sidebar).to_have_js_property('inert', True)
            opener.click()
            page.locator('.course-sidebar-scrim').click(position={'x': width - 10, 'y': 450})
            expect(opener).to_be_focused()
            opener.click()
            closer.click()
            expect(opener).to_be_focused()
            expect(opener).to_have_attribute('aria-expanded', 'false')

        # The same layout must keep working after a chapter/book route changes.
        opener.click()
        sidebar.locator('a[href]:not(.course-index-link):not(.brand):not(.sidebar-home)').first.click()
        expect(opener).to_have_attribute('aria-expanded', 'false')
        expect(sidebar).to_have_js_property('inert', True)
        expect(page.locator('.course-shell > main, .course-shell > .main')).to_have_js_property('inert', False)
        page.emulate_media(reduced_motion='no-preference')
        opener.click()
        expect(closer).to_be_focused()
        page.keyboard.press('Escape')
        expect(opener).to_be_focused()
        page.emulate_media(reduced_motion='reduce')

        # Collection links still resolve correctly when hosted beneath a project path.
        opener.click()
        sidebar.locator('.course-index-link').click()
        expect(page).to_have_url(BASE + '/')
        print(f'PASS {course}: collapse persistence, mobile drawer, keyboard and collection link', flush=True)

    browser.close()
