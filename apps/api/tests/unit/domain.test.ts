import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/env';
import { parseBoardColor } from '../../src/modules/boards/domain/board-color';
import { parseCardLabels } from '../../src/modules/boards/domain/card-labels';
import { placeAt, POSITION_STEP } from '../../src/modules/boards/domain/position';
import { normalizeTitle } from '../../src/modules/boards/domain/rules';
import { normalizeEmail } from '../../src/modules/identity/domain/email';
import { assertStrongPassword } from '../../src/modules/identity/domain/password-policy';
import { isLocked } from '../../src/modules/identity/domain/user';
import { presentCard } from '../../src/modules/boards/application/presenters';
import {
  activeCardFields,
  getSuperpower,
  superpowerOwningField,
} from '../../src/modules/superpowers/domain/superpower';
import { renderPasswordResetEmail } from '../../src/modules/identity/infrastructure/mailers';

describe('normalizeEmail', () => {
  it('trims and lower-cases', () => {
    expect(normalizeEmail('  Ada@Example.COM ')).toBe('ada@example.com');
  });

  it.each(['', 'plain', 'a@b', 'a b@c.com', `${'x'.repeat(250)}@a.com`])('rejects %j', (value) => {
    expect(() => normalizeEmail(value)).toThrow(/valid e-mail/);
  });
});

describe('assertStrongPassword', () => {
  it('accepts long passphrases', () => {
    expect(() => assertStrongPassword('correct-horse-battery')).not.toThrow();
  });

  it('rejects short, common, repetitive and e-mail based passwords', () => {
    expect(() => assertStrongPassword('short')).toThrow(/at least 10/);
    expect(() => assertStrongPassword('password123')).toThrow(/too common/);
    expect(() => assertStrongPassword('aaaaaaaaaaaa')).toThrow(/too common or too simple/);
    expect(() => assertStrongPassword('x'.repeat(129))).toThrow(/at most 128/);
    expect(() => assertStrongPassword('maria-silva-2026', { email: 'maria-silva@x.com' })).toThrow(
      /e-mail/,
    );
  });
});

describe('isLocked', () => {
  const now = new Date('2026-01-01T12:00:00Z');
  it('is locked only while lockedUntil is in the future', () => {
    expect(isLocked({ lockedUntil: null }, now)).toBe(false);
    expect(isLocked({ lockedUntil: new Date('2026-01-01T11:59:59Z') }, now)).toBe(false);
    expect(isLocked({ lockedUntil: new Date('2026-01-01T12:00:01Z') }, now)).toBe(true);
  });
});

describe('placeAt (fractional ordering)', () => {
  it('uses the step for the first item', () => {
    expect(placeAt([], 0)).toEqual({ position: POSITION_STEP, reindexedSiblings: null });
  });

  it('appends after the last sibling', () => {
    expect(placeAt([1024, 2048], 2).position).toBe(3072);
  });

  it('prepends before the first sibling', () => {
    expect(placeAt([1024, 2048], 0).position).toBe(0);
  });

  it('inserts at the midpoint', () => {
    expect(placeAt([1024, 2048], 1).position).toBe(1536);
  });

  it('clamps out-of-range indexes', () => {
    expect(placeAt([1024], 99).position).toBe(2048);
    expect(placeAt([1024], -5).position).toBe(0);
  });

  it('reindexes siblings when the gap is exhausted', () => {
    const result = placeAt([1, 1 + 1e-9, 2], 1);
    expect(result.reindexedSiblings).toEqual([1024, 2048, 3072]);
    expect(result.position).toBe(1536);
  });

  it('always yields a strictly ordered sequence after many inserts', () => {
    let positions: number[] = [];
    for (let i = 0; i < 200; i += 1) {
      const placement = placeAt(positions, 1);
      if (placement.reindexedSiblings) positions = placement.reindexedSiblings;
      positions = [...positions.slice(0, 1), placement.position, ...positions.slice(1)];
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
      expect(new Set(positions).size).toBe(positions.length);
    }
  });
});

describe('board colors and card labels', () => {
  it('accepts palette keys and hex values', () => {
    expect(parseBoardColor(' violet ')).toBe('violet');
    expect(parseBoardColor('#FFAA00')).toBe('#ffaa00');
  });

  it.each(['', 'red', '#fff', '#12345g', 'url(x)'])('rejects the board color %j', (value) => {
    expect(() => parseBoardColor(value)).toThrow(/palette/);
  });

  it('de-duplicates labels and rejects unknown ones', () => {
    expect(parseCardLabels(['red', 'red', 'blue'])).toEqual(['red', 'blue']);
    expect(() => parseCardLabels(['nope'])).toThrow(/Unknown label/);
  });
});

describe('normalizeTitle', () => {
  it('collapses whitespace and enforces bounds', () => {
    expect(normalizeTitle('  a   b  ', 10, 'title')).toBe('a b');
    expect(() => normalizeTitle('   ', 10, 'title')).toThrow();
    expect(() => normalizeTitle('x'.repeat(11), 10, 'title')).toThrow();
  });
});

describe('superpowers', () => {
  it('activates only the fields owned by enabled superpowers', () => {
    expect([...activeCardFields([])]).toEqual([]);
    expect([...activeCardFields(['due-dates'])]).toEqual(['dueAt']);
    expect([...activeCardFields(['due-dates', 'color-labels', 'unknown'])].sort()).toEqual([
      'dueAt',
      'labels',
    ]);
  });

  it('resolves the owner of a field and unknown keys', () => {
    expect(superpowerOwningField('labels')?.key).toBe('color-labels');
    expect(() => getSuperpower('nope')).toThrow(/not found/);
  });

  it('omits disabled superpower fields from presented cards', () => {
    const card = {
      id: '1',
      boardId: 'b',
      listId: 'l',
      title: 'T',
      description: '',
      position: 1,
      dueAt: new Date('2030-01-01T00:00:00Z'),
      labels: ['red'],
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    expect(presentCard(card, [])).not.toHaveProperty('dueAt');
    expect(presentCard(card, [])).not.toHaveProperty('labels');
    expect(presentCard(card, ['due-dates'])).toMatchObject({ dueAt: '2030-01-01T00:00:00.000Z' });
    expect(presentCard(card, ['color-labels'])).toMatchObject({ labels: ['red'] });
  });
});

describe('loadConfig', () => {
  const base = {
    DATABASE_URL: 'postgres://x',
    JWT_SECRET: 'x'.repeat(32),
  };

  it('applies defaults and normalises origins', () => {
    const config = loadConfig({ ...base, WEB_ORIGIN: 'https://a.com/, https://b.com' });
    expect(config.webOrigins).toEqual(['https://a.com', 'https://b.com']);
    expect(config.port).toBe(3000);
    expect(config.isProduction).toBe(false);
  });

  it('rejects short secrets', () => {
    expect(() => loadConfig({ ...base, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });

  it('requires a Resend key in production', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production' })).toThrow(/RESEND_API_KEY/);
    expect(() =>
      loadConfig({ ...base, NODE_ENV: 'production', RESEND_API_KEY: 're_123' }),
    ).not.toThrow();
  });
});

describe('password reset e-mail', () => {
  it('escapes user controlled values in the HTML body', () => {
    const { html, text } = renderPasswordResetEmail({
      to: 'a@b.com',
      name: '<script>alert(1)</script>',
      resetUrl: 'https://app.test/reset-password#token=abc',
      expiresInMinutes: 60,
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(text).toContain('https://app.test/reset-password#token=abc');
  });
});
