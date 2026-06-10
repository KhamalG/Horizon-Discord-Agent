import * as fs from 'fs';
import * as path from 'path';
import { ZodError } from 'zod';
import { validateSignalRecord } from './schema';

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'signal-record.json'), 'utf-8'),
);

describe('validateSignalRecord', () => {
  it('accepts valid fixture and returns typed object', () => {
    const result = validateSignalRecord(fixture);
    expect(result.ticker).toBe('NVDA');
    expect(result.status).toBe('ANALYZED');
    expect(result.signal.rating).toBe('BUY');
    expect(result.signal.confidence).toBe(0.74);
  });

  it('throws ZodError when a required field is missing', () => {
    const invalid = { ...fixture };
    delete invalid.ticker;
    expect(() => validateSignalRecord(invalid)).toThrow(ZodError);
  });

  it('throws ZodError when confidence is a string instead of number', () => {
    const invalid = {
      ...fixture,
      signal: { ...fixture.signal, confidence: 'high' },
    };
    expect(() => validateSignalRecord(invalid)).toThrow(ZodError);
  });

  it('throws ZodError when status is an invalid enum value', () => {
    const invalid = { ...fixture, status: 'PENDING' };
    expect(() => validateSignalRecord(invalid)).toThrow(ZodError);
  });

  it('throws ZodError when signal contains an unknown extra field', () => {
    const invalid = {
      ...fixture,
      signal: { ...fixture.signal, extra_field: 'unexpected' },
    };
    expect(() => validateSignalRecord(invalid)).toThrow(ZodError);
  });

  it('throws ZodError when summary contains an unknown extra field', () => {
    const invalid = {
      ...fixture,
      summary: { ...fixture.summary, extra_field: 'unexpected' },
    };
    expect(() => validateSignalRecord(invalid)).toThrow(ZodError);
  });
});
