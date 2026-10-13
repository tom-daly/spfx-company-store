import {
  emailFor, noEmailAddress, statusEmailBody, statusEmailDetails, statusEmailOpening, statusEmailRequest,
  statusEmailSubject
} from './statusEmailText';
import type { StatusEmailKind } from './statusEmailText';
import type { IStoreSettings } from './settings';
import { ONE_SIZE } from './types';
import type { IOrder } from './ordersView';
import { SETTINGS, linesOf } from './__fixtures__/orders';

const STORE_URL: string = 'https://contoso.sharepoint.com/sites/store/SitePages/Store.aspx';
const TRACKING_LINK: string = 'https://www.example.com/track/1Z999AA10123456784';
const KINDS: StatusEmailKind[] = ['confirmed', 'ready', 'shipped'];

const order = (changes: Partial<IOrder> = {}): IOrder => ({
  id: 42,
  number: 'CS-0042',
  who: 'Megan Bowen',
  email: 'megan@contoso.com',
  lines: [
    { productId: 1, name: 'Hoodie', price: 22, qty: 2, variant: 'Large' },
    { productId: 2, name: 'Sticker', price: 0, qty: 3, variant: ONE_SIZE }
  ],
  itemLines: ['2 × Hoodie (Large)', '3 × Sticker'],
  items: 5,
  total: 44,
  method: 'Pick up',
  shipTo: [],
  phone: '',
  note: '',
  status: 'Confirmed',
  readyBy: '2026-10-15',
  tracking: '',
  pickedUpOn: '',
  emailSent: true,
  history: [],
  ...changes
});

const shipped = (changes: Partial<IOrder> = {}): IOrder => order({
  method: 'Delivery',
  status: 'Shipped',
  shipTo: ['Megan Bowen', 'Havnegade 4', '1058 Copenhagen', 'Denmark'],
  phone: '+45 1234 5678',
  tracking: TRACKING_LINK,
  ...changes
});

const body = (kind: StatusEmailKind, o: IOrder = order(), settings: IStoreSettings = SETTINGS): string =>
  statusEmailBody(settings, kind, o, STORE_URL);

const links = (html: string): number => (html.match(/<a /g) || []).length;

/* A line promising a day, like "Ready for pick-up by Thu 15 Oct 2026." */
const saysADay = (line: string): boolean => /\bby (Sun|Mon|Tue|Wed|Thu|Fri|Sat) /.test(line);

describe('emailFor', () => {
  it('has an email for confirmed, ready for pick-up and shipped', () => {
    expect(emailFor('Confirmed')).toBe('confirmed');
    expect(emailFor('Ready for pick-up')).toBe('ready');
    expect(emailFor('Shipped')).toBe('shipped');
  });

  it('has none for the other steps', () => {
    expect(emailFor('New')).toBeUndefined();
    expect(emailFor('Packed')).toBeUndefined();
    expect(emailFor('Picked up')).toBeUndefined();
  });
});

describe('statusEmailSubject', () => {
  it('names the order in the standard wording of each email', () => {
    expect(statusEmailSubject(SETTINGS, 'confirmed', order())).toBe('Your order CS-0042 is confirmed');
    expect(statusEmailSubject(SETTINGS, 'ready', order())).toBe('Your order CS-0042 is ready for pick-up');
    expect(statusEmailSubject(SETTINGS, 'shipped', shipped())).toBe('Your order CS-0042 is on its way');
  });

  it('uses the owner\'s own subject, filled in and on one line', () => {
    const settings = { ...SETTINGS, readySubject: '  {first name}, order {order}\n  is   ready ({total}) ' };
    expect(statusEmailSubject(settings, 'ready', order())).toBe('Megan, order CS-0042 is ready ($44.00)');
  });

  it('falls back to the standard subject when the owner cleared it', () => {
    const settings = { ...SETTINGS, confirmedSubject: '', readySubject: ' ', shippedSubject: '' };
    expect(statusEmailSubject(settings, 'confirmed', order())).toBe('Your order CS-0042 is confirmed');
    expect(statusEmailSubject(settings, 'ready', order())).toBe('Your order CS-0042 is ready for pick-up');
    expect(statusEmailSubject(settings, 'shipped', shipped())).toBe('Your order CS-0042 is on its way');
  });

  it('keeps a name as typed, since a subject is never read as HTML', () => {
    const settings = { ...SETTINGS, shippedSubject: 'For {name}' };
    expect(statusEmailSubject(settings, 'shipped', shipped({ who: 'Ana & Bo <Ops>' }))).toBe('For Ana & Bo <Ops>');
  });
});

describe('the opening', () => {
  it('opens each email with the owner\'s words, filled in for the person who ordered', () => {
    expect(linesOf(body('confirmed'))[0]).toBe("Hi Megan, thanks for your order. We have it and we're getting it ready.");
    expect(linesOf(body('ready'))[0]).toBe('Hi Megan, your order is ready. Come and pick it up whenever suits you.');
    expect(linesOf(body('shipped', shipped()))[0]).toBe('Hi Megan, your order is on its way.');
  });

  it('gives the opening as plain text for Customize', () => {
    const settings = { ...SETTINGS, confirmedMessage: '  Thanks, {name}.  ' };
    expect(statusEmailOpening(settings, 'confirmed', order({ who: 'Ana & Bo' }))).toBe('Thanks, Ana & Bo.');
  });

  it('keeps the line breaks the owner typed', () => {
    const settings = { ...SETTINGS, readyMessage: 'Hi {first name},\nit is ready.' };
    expect(body('ready', order(), settings)).toContain('Hi Megan,<br>it is ready.');
  });

  it('leaves the opening out when the owner cleared it', () => {
    const settings = { ...SETTINGS, confirmedMessage: '', readyMessage: '  ', shippedMessage: '' };
    KINDS.forEach(kind => {
      const o = kind === 'shipped' ? shipped() : order();
      expect(statusEmailOpening(settings, kind, o)).toBe('');
      const html = statusEmailBody(settings, kind, o, STORE_URL);
      expect(html.replace(/^<div[^>]*>/, '').replace(/<\/div>$/, '')).toBe(statusEmailDetails(settings, kind, o, STORE_URL));
    });
    expect(linesOf(body('confirmed', order(), settings))[0]).toBe('Ready for pick-up by Thu 15 Oct 2026.');
  });

  it('uses the email address as the name when there is no name', () => {
    const settings = { ...SETTINGS, confirmedMessage: 'Hi {name}.' };
    expect(statusEmailOpening(settings, 'confirmed', order({ who: '' }))).toBe('Hi megan@contoso.com.');
  });
});

describe('the order confirmed email', () => {
  it('says when a pick-up will be ready', () => {
    const lines = linesOf(body('confirmed'));
    expect(lines).toContain('Ready for pick-up by Thu 15 Oct 2026.');
    expect(lines.filter(l => l.indexOf('We expect') === 0)).toEqual([]);
  });

  it('says when a delivery should go out', () => {
    const lines = linesOf(body('confirmed', order({ method: 'Delivery', shipTo: ['Megan Bowen', 'Havnegade 4'] })));
    expect(lines).toContain('We expect to send it by Thu 15 Oct 2026.');
    expect(lines.filter(l => l.indexOf('Ready for pick-up') === 0)).toEqual([]);
  });

  it('says nothing about a day when the store has not set one', () => {
    [order({ readyBy: '' }), order({ readyBy: '2026-02-31' }), order({ method: 'Delivery', readyBy: '' })].forEach(o => {
      const details = linesOf(statusEmailDetails(SETTINGS, 'confirmed', o, STORE_URL));
      expect(details[0]).toBe('What you ordered');
      expect(details.filter(saysADay)).toEqual([]);
    });
  });

  it('leaves out the pick-up instructions, the tracking and the address', () => {
    const lines = linesOf(body('confirmed', shipped({ status: 'Confirmed' })));
    expect(lines).not.toContain('Pick up at the office');
    expect(lines).not.toContain('Sent to');
    expect(lines.filter(l => l.indexOf('Tracking') === 0)).toEqual([]);
  });
});

describe('the ready for pick-up email', () => {
  it('gives the pick-up instructions', () => {
    const lines = linesOf(body('ready', order({ status: 'Ready for pick-up' })));
    expect(lines.slice(1, 3)).toEqual(['Pick up at the office', 'Pick it up at the front desk.']);
  });

  it('keeps the line breaks in the instructions', () => {
    const settings = { ...SETTINGS, pickUpNote: 'Front desk, ground floor.\nBring your badge.' };
    expect(body('ready', order(), settings)).toContain('Front desk, ground floor.<br>Bring your badge.');
  });

  it('leaves the instructions out when there are none', () => {
    const lines = linesOf(body('ready', order(), { ...SETTINGS, pickUpNote: '  ' }));
    expect(lines).not.toContain('Pick up at the office');
    expect(lines[1]).toBe('What you ordered');
  });

  it('does not repeat the ready-by day', () => {
    expect(linesOf(body('ready')).filter(saysADay)).toEqual([]);
  });
});

describe('the on its way email', () => {
  it('makes a tracking web address a link', () => {
    const html = body('shipped', shipped());
    expect(html).toContain(`<a href="${TRACKING_LINK}"`);
    expect(linesOf(html)).toContain(`Tracking: ${TRACKING_LINK}`);
    expect(links(html)).toBe(2);
  });

  it('links an http address too, whatever the capitals', () => {
    expect(body('shipped', shipped({ tracking: 'HTTP://track.example/1' }))).toContain('<a href="HTTP://track.example/1"');
  });

  it('links a tracking number to its carrier, and names the carrier', () => {
    const html = body('shipped', shipped({ tracking: '9400111298370084628366' }));
    expect(html).toContain('<a href="https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111298370084628366"');
    expect(linesOf(html)).toContain('USPS tracking: 9400111298370084628366');
    expect(links(html)).toBe(2);
  });

  it('shows a tracking number it does not recognise as plain text', () => {
    const html = body('shipped', shipped({ tracking: 'JD014600006281' }));
    expect(linesOf(html)).toContain('Tracking: JD014600006281');
    expect(links(html)).toBe(1);
  });

  it('never makes anything but a web address a link', () => {
    // eslint-disable-next-line no-script-url -- checking a harmful address is never made a link
    ['javascript:alert(1)', 'ftp://example.com/1', 'Sent with the courier'].forEach(tracking => {
      const html = body('shipped', shipped({ tracking }));
      expect(linesOf(html)).toContain(`Tracking: ${tracking}`);
      expect(links(html)).toBe(1);
    });
    // A web address pasted without its https:// is still one, and is linked with it.
    expect(body('shipped', shipped({ tracking: 'www.example.com/track/1' })))
      .toContain('<a href="https://www.example.com/track/1"');
  });

  it('leaves the tracking line out when there is none', () => {
    const lines = linesOf(body('shipped', shipped({ tracking: ' ' })));
    expect(lines.filter(l => l.indexOf('Tracking') === 0)).toEqual([]);
    expect(lines[1]).toBe('Sent to');
  });

  it('gives the address it went to, line by line, without the phone number', () => {
    const html = body('shipped', shipped());
    expect(linesOf(html).slice(1, 4)).toEqual([`Tracking: ${TRACKING_LINK}`, 'Sent to', 'Megan Bowen']);
    expect(html).toContain('Megan Bowen<br>Havnegade 4<br>1058 Copenhagen<br>Denmark');
    expect(html).not.toContain('+45');
  });

  it('leaves the address out when there is none', () => {
    expect(linesOf(body('shipped', shipped({ shipTo: [' '] })))).not.toContain('Sent to');
  });
});

describe('what they ordered', () => {
  it('lists each item with how many, the size only when there is a choice, and the total', () => {
    KINDS.forEach(kind => {
      const lines = linesOf(body(kind, kind === 'shipped' ? shipped() : order()));
      const at = lines.indexOf('What you ordered');
      expect(lines.slice(at, at + 12)).toEqual([
        'What you ordered',
        'Qty', 'Item', 'Price',
        '2', 'Hoodie (Large)', '$44.00',
        '3', 'Sticker', 'Free',
        'Total', '$44.00'
      ]);
      expect(lines).not.toContain('Nothing to pay.');
    });
  });

  it('says there is nothing to pay when everything is free', () => {
    const free = order({ total: 0, lines: [{ productId: 2, name: 'Sticker', price: 0, qty: 3, variant: ONE_SIZE }] });
    const lines = linesOf(body('confirmed', free));
    expect(lines).toContain('Nothing to pay.');
    expect(lines[lines.indexOf('Total') + 1]).toBe('Free');
  });

  it('shows the price in the store currency', () => {
    expect(linesOf(body('ready', order(), { ...SETTINGS, currency: 'EUR' }))).toContain('€44.00');
  });

  it('falls back to the items list when the order data could not be read', () => {
    const lines = linesOf(body('confirmed', order({ lines: [] })));
    const at = lines.indexOf('What you ordered');
    expect(lines.slice(at, at + 4)).toEqual(['What you ordered', '2 × Hoodie (Large)', '3 × Sticker', 'Total: $44.00']);
    expect(lines).not.toContain('Qty');
  });

  it('leaves the section out when there is nothing to list at all', () => {
    expect(linesOf(body('confirmed', order({ lines: [], itemLines: [] })))).not.toContain('What you ordered');
  });
});

describe('the end of the email', () => {
  it('links to My orders on the store page', () => {
    const html = body('confirmed');
    expect(html).toContain(`<a href="${STORE_URL}#my-orders"`);
    expect(linesOf(html)).toContain('See your orders');
  });

  it('does not end up with two #s when the store address already has one', () => {
    const html = statusEmailBody(SETTINGS, 'ready', order(), `${STORE_URL}#orders`);
    expect(html).toContain(`<a href="${STORE_URL}#my-orders"`);
  });

  it('leaves the link out when there is no store address', () => {
    const html = statusEmailBody(SETTINGS, 'ready', order(), '');
    expect(linesOf(html)).not.toContain('See your orders');
    expect(links(html)).toBe(0);
  });

  it('ends with a small note saying who sent it', () => {
    KINDS.forEach(kind => {
      const lines = linesOf(body(kind, kind === 'shipped' ? shipped() : order()));
      expect(lines[lines.length - 1]).toBe('Sent by the company store. Reply to this email if you have any questions.');
    });
  });
});

describe('anything people typed', () => {
  it('shows as plain text, never as HTML', () => {
    const settings: IStoreSettings = {
      ...SETTINGS,
      shippedMessage: 'Hi {name}, <b>bold</b> news.',
      pickUpNote: 'Ask for <b>Ana</b>'
    };
    const sneaky = shipped({
      who: 'Megan <script>alert(1)</script>',
      tracking: 'https://evil.example/"><script>alert(2)</script>',
      shipTo: ['Flat 2 & 3', '<a href="http://evil.example">Click</a>'],
      lines: [{ productId: 1, name: 'Mug <i>new</i>', price: 10, qty: 1, variant: '<u>Big</u>' }]
    });
    const html = statusEmailBody(settings, 'shipped', sneaky, STORE_URL);
    expect(html).not.toMatch(/<script|<img|<b>|<i>|<u>|<a href="http:\/\/evil|"><script/);
    expect(html).toContain('Megan &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('href="https://evil.example/&quot;&gt;&lt;script&gt;alert(2)&lt;/script&gt;"');
    expect(html).toContain('Flat 2 &amp; 3');
    expect(linesOf(html)).toContain('Mug <i>new</i> (<u>Big</u>)');
    expect(linesOf(html)[0]).toBe('Hi Megan <script>alert(1)</script>, <b>bold</b> news.');

    const ready = statusEmailBody(settings, 'ready', order({ itemLines: ['1 × <i>Cap</i>'], lines: [] }), STORE_URL);
    expect(ready).not.toMatch(/<b>|<i>/);
    expect(linesOf(ready)).toContain('Ask for <b>Ana</b>');
    expect(linesOf(ready)).toContain('1 × <i>Cap</i>');
  });

  it('can\'t break out of the link to My orders', () => {
    const html = statusEmailBody(SETTINGS, 'confirmed', order(), 'https://x.example/"onmouseover="alert(1)');
    expect(html).toContain('href="https://x.example/&quot;onmouseover=&quot;alert(1)#my-orders"');
  });
});

describe('statusEmailRequest', () => {
  it('goes to the person who ordered, by name, and stays in the sender\'s Sent Items', () => {
    const request = statusEmailRequest(SETTINGS, 'confirmed', order(), STORE_URL);
    expect(request.message.subject).toBe('Your order CS-0042 is confirmed');
    expect(request.message.body).toEqual({
      contentType: 'HTML', content: statusEmailBody(SETTINGS, 'confirmed', order(), STORE_URL)
    });
    expect(request.message.toRecipients).toEqual([{ emailAddress: { address: 'megan@contoso.com', name: 'Megan Bowen' } }]);
    expect(request.message.ccRecipients).toEqual([]);
    expect(request.saveToSentItems).toBe(true);
  });

  it('builds each kind of email with its own subject and body', () => {
    KINDS.forEach(kind => {
      const o = kind === 'shipped' ? shipped() : order();
      const request = statusEmailRequest(SETTINGS, kind, o, STORE_URL);
      expect(request.message.subject).toBe(statusEmailSubject(SETTINGS, kind, o));
      expect(request.message.body.content).toBe(statusEmailBody(SETTINGS, kind, o, STORE_URL));
    });
  });

  it('sends replies to the store\'s order email addresses, each once', () => {
    const settings = { ...SETTINGS, orderEmails: 'store@contoso.com; HR@contoso.com, Store@Contoso.com' };
    expect(statusEmailRequest(settings, 'ready', order(), STORE_URL).message.replyTo).toEqual([
      { emailAddress: { address: 'store@contoso.com' } },
      { emailAddress: { address: 'HR@contoso.com' } }
    ]);
  });

  it('lets replies go back to the sender when the store has no order email addresses', () => {
    const request = statusEmailRequest({ ...SETTINGS, orderEmails: ' , ' }, 'ready', order(), STORE_URL);
    expect(request.message.replyTo).toBeUndefined();
    expect(Object.keys(request.message)).not.toContain('replyTo');
  });

  it('tidies the address, and leaves the name out when there is none', () => {
    expect(statusEmailRequest(SETTINGS, 'ready', order({ who: ' ', email: ' megan@contoso.com ' }), STORE_URL)
      .message.toRecipients).toEqual([{ emailAddress: { address: 'megan@contoso.com' } }]);
  });

  it('refuses when there is no email address, saying for whom', () => {
    expect(() => statusEmailRequest(SETTINGS, 'confirmed', order({ email: '' }), STORE_URL))
      .toThrow("There's no email address for Megan Bowen, so no email went.");
    expect(() => statusEmailRequest(SETTINGS, 'shipped', shipped({ email: '   ' }), STORE_URL))
      .toThrow("There's no email address for Megan Bowen, so no email went.");
    expect(() => statusEmailRequest(SETTINGS, 'ready', order({ email: '', who: '' }), STORE_URL))
      .toThrow(noEmailAddress(''));
    expect(noEmailAddress('')).toBe("There's no email address for whoever placed it, so no email went.");
  });
});
