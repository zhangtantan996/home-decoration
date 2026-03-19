import { formatProviderPricing, normalizePricingUnit } from '../providerPricing';

describe('providerPricing', () => {
  it('formats designer structured pricing with Chinese labels', () => {
    const result = formatProviderPricing({
      role: 'designer',
      pricingJson: JSON.stringify({ flat: 1200, duplex: 1600, other: 1000 }),
    });

    expect(result.summary).toBe('平层 ¥1200/㎡');
    expect(result.detail).toBe('平层 ¥1200/㎡ · 复式 ¥1600/㎡ · 其他户型 ¥1000/㎡');
    expect(result.quoteDisplay.title).toBe('设计费');
    expect(result.quoteDisplay.primary).toBe('¥1200/㎡');
    expect(result.quoteDisplay.secondary).toBe('平层 ¥1200/㎡ · 复式 ¥1600/㎡ · 其他户型 ¥1000/㎡');
    expect(result.quoteDisplay.status).toBe('priced');
  });

  it('formats foreman structured pricing without leaking perSqm', () => {
    const result = formatProviderPricing({
      role: 'foreman',
      pricingJson: JSON.stringify({ perSqm: 599 }),
    });

    expect(result.summary).toBe('施工报价 ¥599/㎡');
    expect(result.detail).toBe('施工报价 ¥599/㎡');
    expect(result.quoteDisplay.title).toBe('施工报价');
    expect(result.quoteDisplay.primary).toBe('¥599/㎡');
    expect(result.quoteDisplay.secondary).toBe('');
  });

  it('formats company structured pricing with package labels', () => {
    const result = formatProviderPricing({
      role: 'company',
      pricingJson: JSON.stringify({ fullPackage: 1200, halfPackage: 800 }),
    });

    expect(result.summary).toBe('全包 ¥1200/㎡');
    expect(result.detail).toBe('全包 ¥1200/㎡ · 半包 ¥800/㎡');
    expect(result.quoteDisplay.title).toBe('参考报价');
    expect(result.quoteDisplay.primary).toBe('¥1200/㎡');
    expect(result.quoteDisplay.secondary).toBe('全包 ¥1200/㎡ · 半包 ¥800/㎡');
  });

  it('hides unknown keys behind natural labels', () => {
    const result = formatProviderPricing({
      role: 'designer',
      pricingJson: JSON.stringify({ strangeKey: 888 }),
    });

    expect(result.summary).toBe('¥888/㎡');
    expect(result.detail).toBe('其他报价 ¥888/㎡');
    expect(result.quoteDisplay.primary).toBe('¥888/㎡');
    expect(result.quoteDisplay.secondary).toBe('其他报价 ¥888/㎡');
  });

  it('falls back to normalized range when json is invalid', () => {
    const result = formatProviderPricing({
      role: 'company',
      pricingJson: '{oops',
      priceMin: 80000,
      priceMax: 150000,
      priceUnit: '元/全包',
    });

    expect(result.summary).toBe('8-15万/全包');
    expect(result.detail).toBe('8-15万/全包');
    expect(result.quoteDisplay.primary).toBe('8-15万/全包');
    expect(result.quoteDisplay.secondary).toBe('');
  });

  it('returns natural fallback for empty pricing', () => {
    const result = formatProviderPricing({ role: 'foreman' });

    expect(result.summary).toBe('报价面议');
    expect(result.detail).toBe('按需求沟通');
    expect(result.quoteDisplay.status).toBe('negotiable');
    expect(result.quoteDisplay.secondary).toBe('按需求沟通');
  });

  it('normalizes noisy units', () => {
    expect(normalizePricingUnit('元/平米')).toBe('/㎡');
    expect(normalizePricingUnit('万元/全包')).toBe('万/全包');
    expect(normalizePricingUnit('元/天')).toBe('/天');
  });
});
