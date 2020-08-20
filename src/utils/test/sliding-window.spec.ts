import { slidingWindow } from '../sliding-window';

describe('Utils / sliding-window()', () => {
  it('returns window slice over left edge', () => {
    const window = slidingWindow([1, 2, 3, 4, 5], 0, 1);

    expect(window).toStrictEqual([5, 1, 2]);
  });

  it('returns window slice', () => {
    const window = slidingWindow([1, 2, 3, 4, 5], 1, 1);

    expect(window).toStrictEqual([1, 2, 3]);
  });

  it('returns window slice over right edge', () => {
    const window = slidingWindow([1, 2, 3, 4, 5], 4, 1);

    expect(window).toStrictEqual([4, 5, 1]);
  });

  it('returns window slice over left edge (size: 2)', () => {
    const window = slidingWindow([1, 2, 3, 4, 5], 1, 2);

    expect(window).toStrictEqual([5, 1, 2, 3, 4]);
  });

  it('returns window slice (size: 2)', () => {
    const window = slidingWindow([1, 2, 3, 4, 5], 2, 2);

    expect(window).toStrictEqual([1, 2, 3, 4, 5]);
  });

  it('returns window slice over right edge (size: 2)', () => {
    const window = slidingWindow([1, 2, 3, 4, 5], 4, 2);

    expect(window).toStrictEqual([3, 4, 5, 1, 2]);
  });
});
