import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { detectApiBaseFromLocation, computeApiUrl } from '../src/utils/connection';
import { obfuscatedStorage } from '../src/services/storage/secureStorage';
import { readAuthFilesUiState, writeAuthFilesUiState } from '../src/features/authFiles/uiState';
import { readQuotaUiState, writeQuotaUiState } from '../src/features/quota/uiState';

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let location: URL;
let values: Map<string, string>;

beforeEach(() => {
  location = new URL('https://panel.example/management.html');
  values = new Map();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
  const sessionValues = new Map<string, string>();
  const sessionStorage = {
    getItem: (key: string) => sessionValues.get(key) ?? null,
    setItem: (key: string, value: string) => void sessionValues.set(key, value),
    removeItem: (key: string) => void sessionValues.delete(key),
  };
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location, localStorage: storage, sessionStorage },
  });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
});

afterEach(() => {
  for (const [name, descriptor] of [
    ['window', originalWindow],
    ['localStorage', originalStorage],
  ] as const) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('panels mounted at separate reverse-proxy paths', () => {
  test.each([
    ['/management.html', 'https://panel.example'],
    ['/', 'https://panel.example'],
    ['/fd/management.html#/auth-files', 'https://panel.example/fd'],
    ['/fd/', 'https://panel.example/fd'],
    ['/teams/lb/index.html?theme=dark#/quota', 'https://panel.example/teams/lb'],
  ])('detects the API beside %s', (path, expected) => {
    location.href = `https://panel.example${path}`;
    expect(detectApiBaseFromLocation()).toBe(expected);
    expect(computeApiUrl(detectApiBaseFromLocation())).toBe(`${expected}/v8/management`);
  });

  test('keeps saved credentials separate and preserves the existing root login', () => {
    obfuscatedStorage.setItem('managementKey', 'root-fixture-key');
    location.pathname = '/fd/management.html';
    expect(obfuscatedStorage.getItem('managementKey')).toBeNull();
    obfuscatedStorage.setItem('managementKey', 'fd-fixture-key');
    location.pathname = '/lb/management.html';
    expect(obfuscatedStorage.getItem('managementKey')).toBeNull();
    obfuscatedStorage.setItem('managementKey', 'lb-fixture-key');

    location.pathname = '/fd/';
    expect(obfuscatedStorage.getItem('managementKey')).toBe('fd-fixture-key');
    obfuscatedStorage.removeItem('managementKey');
    location.pathname = '/lb/management.html';
    expect(obfuscatedStorage.getItem('managementKey')).toBe('lb-fixture-key');
    location.pathname = '/management.html';
    expect(obfuscatedStorage.getItem('managementKey')).toBe('root-fixture-key');
  });

  test('does not migrate legacy plaintext credentials from another panel', () => {
    values.set('managementKey', 'legacy-root-fixture');
    location.pathname = '/fd/management.html';
    obfuscatedStorage.migratePlaintextKeys(['managementKey']);
    expect(obfuscatedStorage.getItem('managementKey')).toBeNull();
    expect(values.get('managementKey')).toBe('legacy-root-fixture');
  });

  test('keeps account filters and session quota preferences in their own panel', () => {
    location.pathname = '/fd/management.html';
    writeAuthFilesUiState({ search: 'fd-account@example.test', page: 2 });
    writeQuotaUiState({ tab: 'claude', sortMode: 'soonest' });
    location.pathname = '/lb/management.html';
    expect(readAuthFilesUiState()).toBeNull();
    expect(readQuotaUiState()).toBeNull();
    location.pathname = '/fd/management.html';
    expect(readAuthFilesUiState()).toEqual({ search: 'fd-account@example.test', page: 2 });
    expect(readQuotaUiState()).toEqual({ tab: 'claude', sortMode: 'soonest' });
  });
});
