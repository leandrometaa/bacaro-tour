import { describe, expect, it } from 'vitest';
import { deriveMoodsFromType } from './moods';

describe('deriveMoodsFromType', () => {
  it('maps bar/cafe to aperitivo', () => {
    expect(deriveMoodsFromType('bar', 'Al Volto')).toContain('aperitivo');
    expect(deriveMoodsFromType('cafe', 'Caffè Pedrocchi')).toContain(
      'aperitivo'
    );
  });

  it('maps bacaro / enoteca names to vino', () => {
    const moods = deriveMoodsFromType('bacaro', 'Bacaro Dai Zemei');
    expect(moods).toContain('aperitivo');
    expect(moods).toContain('vino-tagliere');
  });

  it('maps pizzeria and restaurant', () => {
    expect(deriveMoodsFromType('pizzeria', 'Da Pino')).toContain('pizza');
    expect(deriveMoodsFromType('ristorante', 'Trattoria ai Prati')).toContain(
      'cena'
    );
  });
});
