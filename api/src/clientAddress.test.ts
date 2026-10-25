import { HttpRequest } from '@azure/functions';
import { describe, expect, it } from 'vitest';
import { clientAddress } from './http';

const request = (forwarded?: string) =>
  new HttpRequest({ url: 'http://localhost/api/play/join', method: 'POST', headers: forwarded === undefined ? {} : { 'x-forwarded-for': forwarded } });

describe('clientAddress', () => {
  it('takes the first address and drops the port', () => {
    expect(clientAddress(request('203.0.113.7:51234, 10.0.0.1'))).toBe('203.0.113.7');
    expect(clientAddress(request('198.51.100.2'))).toBe('198.51.100.2');
  });

  it('keeps IPv6 addresses intact', () => {
    expect(clientAddress(request('2001:db8::1'))).toBe('2001:db8::1');
    expect(clientAddress(request('[2001:db8::1]:5555'))).toBe('2001:db8::1');
  });

  it('falls back to "unknown" when the header is missing or empty', () => {
    expect(clientAddress(request())).toBe('unknown');
    expect(clientAddress(request('   '))).toBe('unknown');
  });

  it('never returns characters that Table Storage rejects in keys, or something very long', () => {
    expect(clientAddress(request('a/b#c?d\\e'))).toBe('a_b_c_d_e');
    expect(clientAddress(request('x'.repeat(500)))).toHaveLength(64);
  });
});
