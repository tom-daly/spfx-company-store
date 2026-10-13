import { ISample, SAMPLES, VIEWS, sampleSvg } from './samples';
import { allCombos, checkOptions, variantLabel } from './variants';

const byName = (name: string): ISample => SAMPLES.filter(s => s.draft.name === name)[0];

describe('the sample products', () => {
  it('give every sample one stock line per combination, titled the way checkout looks for it', () => {
    SAMPLES.forEach(s => {
      expect(checkOptions(s.draft.options)).toBeUndefined();
      expect(s.draft.stock.map(l => l.label))
        .toEqual(allCombos(s.draft.options).map(c => variantLabel(s.draft.options, c)));
    });
  });

  it('make the tee come in two colours and six sizes, with XXL costing 2 more', () => {
    const tee = byName('Reef crew tee').draft;
    expect(tee.options.map(o => o.name)).toEqual(['Colour', 'Size']);
    expect(tee.price).toBe(22);
    expect(tee.stock.filter(l => l.ownPrice !== undefined).map(l => [l.label, l.ownPrice]))
      .toEqual([['White · XXL', 24], ['Black · XXL', 24]]);
    expect(tee.stock.filter(l => l.inStock === 0).map(l => l.label))
      .toEqual(['White · XS', 'Black · L', 'Black · XXL']);
  });

  it('make the hoodie vary by size only, with some sizes gone', () => {
    const hoodie = byName('Crew hoodie').draft;
    expect(hoodie.options.map(o => o.name)).toEqual(['Size']);
    expect(hoodie.stock.filter(l => l.inStock === 0).map(l => l.label)).toEqual(['XS', 'XXL']);
  });

  it('draw pictures for each colour of the tee and the bottle, and none for sizes', () => {
    expect(SAMPLES.filter(s => s.looks).map(s => [s.draft.name, Object.keys(s.looks || {})])).toEqual([
      ['Reef crew tee', ['White', 'Black']],
      ['Insulated bottle', ['Forest', 'White', 'Black']]
    ]);
  });

  it('give the tee\'s colours a front and a back each, and the bottle\'s one or two pictures each', () => {
    const tee = byName('Reef crew tee').looks || {};
    expect(tee.White.views).toEqual(['Front', 'Back']);
    expect(tee.Black.views).toEqual(['Front', 'Back']);
    expect(tee.White.fill).not.toBe(tee.Black.fill);
    const bottle = byName('Insulated bottle').looks || {};
    Object.keys(bottle).forEach(colour => {
      expect(bottle[colour].views.length).toBeGreaterThanOrEqual(1);
      expect(bottle[colour].views.length).toBeLessThanOrEqual(2);
    });
  });

  it('start every sample with no saved photos, as its drawn ones go up as new files, front first', () => {
    expect(SAMPLES.every(s => s.draft.photos.length === 0)).toBe(true);
    expect(VIEWS).toEqual(['Front', 'Back', 'Detail']);
  });

  it('draw the back flipped and the detail bigger, each labelled with its view', () => {
    const cap = byName('Dive cap');
    const front = sampleSvg(cap, 'Front');
    const back = sampleSvg(cap, 'Back');
    const detail = sampleSvg(cap, 'Detail');
    expect(front).toContain('translate(100,72) scale(1)"');
    expect(front).toContain('>Front</text>');
    expect(back).toContain('translate(100,72) scale(1) scale(-1,1)"');
    expect(back).toContain('>Back</text>');
    expect(detail).toContain('translate(100,72) scale(1.5)"');
    expect(detail).toContain('>Detail</text>');
    // Three different pictures, not three copies.
    expect(front).not.toBe(back);
    expect(front).not.toBe(detail);
  });

  it('draw a colour\'s pictures with the shape in that colour', () => {
    expect(sampleSvg(byName('Reef crew tee'), 'Back', '#2d3035')).toContain('fill="#2d3035" opacity=".92"');
    expect(sampleSvg(byName('Reef crew tee'))).toContain('fill="#ffffff" opacity=".92"');
  });

  it('leave the rest as one size', () => {
    expect(SAMPLES.filter(s => !s.draft.options.length).map(s => s.draft.stock.map(l => l.label)))
      .toEqual([['One size'], ['One size'], ['One size'], ['One size'], ['One size']]);
  });
});
