/**
 * Offline support: keeps a copy of every file the page needs, so Brace opens
 * without a network connection after the first visit.
 *
 * RELEASE must match the ?v= value in index.html; scripts/release.py updates both.
 * Each release gets its own cache, and older caches are deleted when it takes over.
 */

const RELEASE = '2026-11-09.4';
const CACHE_PREFIX = 'brace-';
const CACHE_NAME = `${CACHE_PREFIX}${RELEASE}`;
const PAGE_URL = './';

// Files that index.html loads with ?v=<release> in the URL
const VERSIONED_FILES = [
  'styles.css',
  'js/main.js',
  'js/json-engine.js',
  'js/syntax-checker.js',
  'js/result-panel.js',
  'js/highlighter.js',
  'js/tree-view.js',
  'js/notifications.js',
  'js/storage.js',
  'js/html.js',
  'js/theme.js',
  'js/offline.js',
];

// Files whose content never changes under the same name
const FIXED_FILES = [
  PAGE_URL,
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'vendor/lossless-json-4.3.3.js',
  'vendor/jsonrepair-3.15.0.min.js',
  'fonts/ibm-plex-sans-400.woff2',
  'fonts/ibm-plex-sans-500.woff2',
  'fonts/ibm-plex-sans-600.woff2',
  'fonts/ibm-plex-mono-400.woff2',
  'fonts/ibm-plex-mono-500.woff2',
  'fonts/ibm-plex-mono-600.woff2',
];

const FILES_TO_CACHE = [
  ...FIXED_FILES,
  ...VERSIONED_FILES.map((path) => `${path}?v=${RELEASE}`),
];

self.addEventListener('install', (event) => {
  event.waitUntil(saveFilesForOffline());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(deleteOlderReleases());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const isOwnFile = new URL(request.url).origin === self.location.origin;
  if (request.method !== 'GET' || !isOwnFile) return;

  event.respondWith(request.mode === 'navigate' ? fetchPageFirst(request) : useSavedFileFirst(request));
});

async function saveFilesForOffline() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(FILES_TO_CACHE);
  await self.skipWaiting(); // take over right away instead of waiting for every tab to close
}

async function deleteOlderReleases() {
  const cacheNames = await caches.keys();
  const olderReleases = cacheNames.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME);
  await Promise.all(olderReleases.map((name) => caches.delete(name)));
  await self.clients.claim();
}

// The page itself: get the newest version when online, and the saved copy when offline.
async function fetchPageFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(PAGE_URL, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(PAGE_URL)) ?? Response.error();
  }
}

// Styles, scripts, fonts and icons: their URLs change with each release, so a saved copy is always current.
async function useSavedFileFirst(request) {
  return (await caches.match(request)) ?? fetch(request);
}
