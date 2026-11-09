#!/usr/bin/env python3
"""
Prepares a new release of Brace. Run it before every push that changes the site.

Browsers keep files for up to 10 minutes, and the offline service worker keeps them until
the next release, so each release needs a new version in every file URL. This script:

  1. sets the new release version in index.html (every ?v=...) and in service-worker.js,
  2. recalculates the Content Security Policy hashes for the inline scripts in index.html
     (the import map changes with every version, so its hash changes too),
  3. checks that every module in js/ is listed in the import map and in the service worker.

Usage:
  python3 scripts/release.py              # today's date plus a counter, e.g. 2026-11-10.1
  python3 scripts/release.py 2026-12-01.1 # a version of your choice
"""
import base64
import datetime
import hashlib
import pathlib
import re
import sys

PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX_FILE = PROJECT_ROOT / 'index.html'
SERVICE_WORKER_FILE = PROJECT_ROOT / 'service-worker.js'
MODULES_FOLDER = PROJECT_ROOT / 'js'
ENTRY_MODULE = 'main.js'

VERSION_PATTERN = r'\d{4}-\d{2}-\d{2}\.\d+'
VERSION_IN_URL = re.compile(r'\?v=(' + VERSION_PATTERN + ')')
VERSION_IN_WORKER = re.compile(r"const RELEASE = '(" + VERSION_PATTERN + ")';")
INLINE_SCRIPT = re.compile(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', re.DOTALL)
SCRIPT_SOURCES_IN_POLICY = re.compile(r"script-src 'self'(?: '[^']+')*")


def fail(message):
    sys.exit(f'Release stopped: {message}')


def next_version(current_version):
    today = datetime.date.today().isoformat()
    current_date, _, current_counter = current_version.partition('.')
    if current_date == today:
        return f'{today}.{int(current_counter) + 1}'
    return f'{today}.1'


def content_security_hash(script_text):
    digest = hashlib.sha256(script_text.encode('utf-8')).digest()
    return "'sha256-" + base64.b64encode(digest).decode('ascii') + "'"


def update_script_hashes(index_html):
    hashes = [content_security_hash(match.group(1)) for match in INLINE_SCRIPT.finditer(index_html)]
    new_script_sources = "script-src 'self' " + ' '.join(hashes)
    updated_html, replacement_count = SCRIPT_SOURCES_IN_POLICY.subn(lambda _: new_script_sources, index_html)
    if replacement_count != 1:
        fail("could not find exactly one \"script-src 'self'\" in the security policy in index.html")
    return updated_html, len(hashes)


def check_modules_are_listed(index_html, service_worker):
    for module_path in sorted(MODULES_FOLDER.glob('*.js')):
        name = module_path.name
        if name != ENTRY_MODULE and f'"./js/{name}"' not in index_html:
            fail(f'js/{name} is missing from the import map in index.html')
        if f"'js/{name}'" not in service_worker:
            fail(f'js/{name} is missing from VERSIONED_FILES in service-worker.js')


def main():
    index_html = INDEX_FILE.read_text(encoding='utf-8')
    service_worker = SERVICE_WORKER_FILE.read_text(encoding='utf-8')

    current_match = VERSION_IN_URL.search(index_html)
    if not current_match:
        fail('no ?v=<version> found in index.html')
    new_version = sys.argv[1] if len(sys.argv) > 1 else next_version(current_match.group(1))
    if not re.fullmatch(VERSION_PATTERN, new_version):
        fail(f'"{new_version}" is not a version like 2026-11-10.1')

    index_html, url_count = VERSION_IN_URL.subn(f'?v={new_version}', index_html)
    service_worker, worker_count = VERSION_IN_WORKER.subn(f"const RELEASE = '{new_version}';", service_worker)
    if worker_count != 1:
        fail("could not find \"const RELEASE = '...';\" in service-worker.js")

    # Hashes are calculated after the version change, because the import map contains the version.
    index_html, hash_count = update_script_hashes(index_html)
    check_modules_are_listed(index_html, service_worker)

    INDEX_FILE.write_text(index_html, encoding='utf-8')
    SERVICE_WORKER_FILE.write_text(service_worker, encoding='utf-8')
    print(f'Release {new_version}: updated {url_count} file URLs, the service worker '
          f'and {hash_count} inline script hashes.')


if __name__ == '__main__':
    main()
