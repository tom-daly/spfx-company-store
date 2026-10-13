import { fillIn, fillInsFor, message, wording } from './messages';
import { DEFAULT_SETTINGS } from './settings';

const MEGAN = { name: 'Megan Bowen', email: 'megan.bowen@contoso.com' };
const ORDER = { number: 'CS-0042', total: 48 };

describe('the owner\'s messages', () => {
  const fills = fillInsFor(ORDER, MEGAN, 'EUR');

  it('swaps every fill-in for the real details', () => {
    expect(fillIn('Thanks, {first name}. {name} ordered {order} for {total}.', fills))
      .toBe('Thanks, Megan. Megan Bowen ordered CS-0042 for €48.00.');
  });

  it('does not mind capitals or spaces inside the braces', () => {
    expect(fillIn('{First Name} / { ORDER } / {firstname}', fills)).toBe('Megan / CS-0042 / Megan');
  });

  it('leaves anything else in braces as typed', () => {
    expect(fillIn('Use {code} at the desk', fills)).toBe('Use {code} at the desk');
  });

  it('uses the email address when there is no name', () => {
    expect(fillInsFor(ORDER, { name: '', email: 'megan@contoso.com' }, 'USD').firstName)
      .toBe('megan@contoso.com');
  });

  it('shows Free for a total of nothing', () => {
    expect(fillInsFor({ number: 'CS-0001', total: 0 }, MEGAN, 'USD').total).toBe('Free');
  });

  it('says nothing when the owner clears a message', () => {
    expect(message({ ...DEFAULT_SETTINGS, placedMessage: '   ' }, 'placedMessage', fills)).toBe('');
  });

  it('never leaves the email without a subject', () => {
    expect(wording({ ...DEFAULT_SETTINGS, emailSubject: '' }, 'emailSubject')).toBe(DEFAULT_SETTINGS.emailSubject);
  });

  it('never leaves any status email without a subject, even one of only spaces', () => {
    const blank = { ...DEFAULT_SETTINGS, confirmedSubject: '', readySubject: '  ', shippedSubject: '\n' };
    expect(wording(blank, 'confirmedSubject')).toBe(DEFAULT_SETTINGS.confirmedSubject);
    expect(wording(blank, 'readySubject')).toBe(DEFAULT_SETTINGS.readySubject);
    expect(wording(blank, 'shippedSubject')).toBe(DEFAULT_SETTINGS.shippedSubject);
    expect(message(blank, 'shippedSubject', fills)).toBe('Your order CS-0042 is on its way');
  });

  it('lets the owner clear the opening of any email', () => {
    const blank = { ...DEFAULT_SETTINGS, emailMessage: '', confirmedMessage: '', readyMessage: ' ', shippedMessage: '' };
    expect(message(blank, 'emailMessage', fills)).toBe('');
    expect(message(blank, 'confirmedMessage', fills)).toBe('');
    expect(message(blank, 'readyMessage', fills)).toBe('');
    expect(message(blank, 'shippedMessage', fills)).toBe('');
  });

  it('lets the owner clear the pick-up instructions', () => {
    expect(message({ ...DEFAULT_SETTINGS, pickUpNote: '' }, 'pickUpNote', fills)).toBe('');
  });

  it('keeps the owner\'s own subject as typed', () => {
    expect(message({ ...DEFAULT_SETTINGS, readySubject: 'Come and get {order}' }, 'readySubject', fills))
      .toBe('Come and get CS-0042');
  });

  it('fills in the standard wording the way it always read', () => {
    expect(message(DEFAULT_SETTINGS, 'placedMessage', fills)).toBe('Thanks, Megan. Your order is in.');
    expect(message(DEFAULT_SETTINGS, 'emailSubject', fills)).toBe('Store order CS-0042 from Megan Bowen');
    expect(message(DEFAULT_SETTINGS, 'emailMessage', fills)).toBe('Megan Bowen placed order CS-0042.');
    expect(message(DEFAULT_SETTINGS, 'pickUpNote', fills)).toBe('Pick it up at the front desk.');
  });

  it('fills in the standard status email wording', () => {
    expect(message(DEFAULT_SETTINGS, 'confirmedSubject', fills)).toBe('Your order CS-0042 is confirmed');
    expect(message(DEFAULT_SETTINGS, 'confirmedMessage', fills))
      .toBe("Hi Megan, thanks for your order. We have it and we're getting it ready.");
    expect(message(DEFAULT_SETTINGS, 'readySubject', fills)).toBe('Your order CS-0042 is ready for pick-up');
    expect(message(DEFAULT_SETTINGS, 'readyMessage', fills))
      .toBe('Hi Megan, your order is ready. Come and pick it up whenever suits you.');
    expect(message(DEFAULT_SETTINGS, 'shippedSubject', fills)).toBe('Your order CS-0042 is on its way');
    expect(message(DEFAULT_SETTINGS, 'shippedMessage', fills)).toBe('Hi Megan, your order is on its way.');
  });
});
