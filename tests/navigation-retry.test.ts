import { isRetryableNavigationError } from '../scrape-utils';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const SEASON_URL = 'https://kosarstat.hu/games/season_games/?season=2627';

test('A CI-ban látott kapcsolat-időtúllépés újrapróbálható', () => {
  // Egy elbukott scrape.yml futás hibája szó szerint: ezt a régi lista nem ismerte fel.
  const error = new Error(`page.goto: net::ERR_CONNECTION_TIMED_OUT at ${SEASON_URL}\nCall log:\n  - navigating to "${SEASON_URL}", waiting until "domcontentloaded"`);
  assert.equal(isRetryableNavigationError(error), true);
});

test('Playwright időtúllépés és a többi átmeneti hálózati hiba újrapróbálható', () => {
  const messages = [
    'page.goto: Timeout 60000ms exceeded.',
    'page.goto: net::ERR_TIMED_OUT at url',
    'page.goto: net::ERR_CONNECTION_RESET at url',
    'page.goto: net::ERR_CONNECTION_REFUSED at url',
    'page.goto: net::ERR_NAME_NOT_RESOLVED at url',
    'page.goto: net::ERR_ADDRESS_UNREACHABLE at url',
    'page.goto: net::ERR_EMPTY_RESPONSE at url',
    'page.goto: net::ERR_NETWORK_CHANGED at url',
  ];
  for (const message of messages) {
    assert.equal(isRetryableNavigationError(new Error(message)), true, message);
  }
});

test('Nem átmeneti hiba nem indít újrapróbálást', () => {
  const messages = [
    'page.goto: net::ERR_CERT_AUTHORITY_INVALID at url',
    'page.goto: net::ERR_ABORTED at url',
    'page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL',
  ];
  for (const message of messages) {
    assert.equal(isRetryableNavigationError(new Error(message)), false, message);
  }
  assert.equal(isRetryableNavigationError(undefined), false);
});
