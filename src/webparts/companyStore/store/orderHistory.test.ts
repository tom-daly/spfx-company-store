import { appendHistory, historyEntry, historyLine, parseHistory } from './orderHistory';

const AT = new Date(Date.UTC(2026, 9, 12, 12, 5, 33));

describe('an order\'s history', () => {
  it('writes one readable line per change: when, who, what', () => {
    expect(historyLine(historyEntry('Thomas Daly', 'Status changed from New to Packed', AT)))
      .toBe('2026-10-12T12:05:33.000Z | Thomas Daly | Status changed from New to Packed');
  });

  it('adds new lines at the end and reads them all back in order', () => {
    let text = appendHistory(undefined, historyEntry('Megan Bowen', 'Order placed', AT));
    text = appendHistory(text, historyEntry('Thomas Daly', 'Status changed from New to Packed', AT));
    expect(parseHistory(text).map(e => `${e.who}: ${e.what}`))
      .toEqual(['Megan Bowen: Order placed', 'Thomas Daly: Status changed from New to Packed']);
  });

  it('keeps a bar or a line break typed into a change from splitting it in two', () => {
    const e = historyEntry('Thomas | Daly', 'Note changed\nto "leave at desk"', AT);
    expect(parseHistory(historyLine(e))).toEqual([
      { when: '2026-10-12T12:05:33.000Z', who: 'Thomas / Daly', what: 'Note changed; to "leave at desk"' }
    ]);
  });

  it('keeps a line written by hand in SharePoint, as it was typed', () => {
    expect(parseHistory('Called Megan about the size')).toEqual([{ when: '', who: '', what: 'Called Megan about the size' }]);
  });

  it('has nothing to show for an order with no history', () => {
    expect(parseHistory(undefined)).toEqual([]);
    expect(parseHistory('  \n ')).toEqual([]);
  });
});
