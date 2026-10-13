import {
  EMAIL_NOT_SENT, NOT_APPROVED, NOT_SENT, NO_ONE_TO_EMAIL, orderEmailBody, orderEmailRequest, orderEmailSubject,
  uniqueEmails, whyEmailFailed
} from './orderEmailText';
import { ONE_SIZE } from './types';
import type { IBuyer, IPlacedOrder } from './types';
import { SETTINGS, linesOf } from './__fixtures__/orders';

const MEGAN: IBuyer = { name: 'Megan Bowen', email: 'megan@contoso.com' };
const ORDERS_URL: string = 'https://contoso.sharepoint.com/sites/store/Lists/CompanyStoreOrders';

const order = (changes: Partial<IPlacedOrder> = {}): IPlacedOrder => ({
  id: 42,
  number: 'CS-0042',
  total: 44,
  lines: [
    { productId: 1, name: 'Hoodie', price: 22, qty: 2, variant: 'Large' },
    { productId: 2, name: 'Sticker', price: 0, qty: 3, variant: ONE_SIZE }
  ],
  method: 'Pick up',
  shipTo: '',
  phone: '',
  note: '',
  ...changes
});

const deliveryOrder = (): IPlacedOrder => order({
  method: 'Delivery',
  shipTo: 'Megan Bowen\nHavnegade 4\n1058 Copenhagen\nDenmark',
  phone: '+45 1234 5678'
});

const graphError = (statusCode: number, code: string, message: string): Error =>
  Object.assign(new Error(message), { statusCode, code });

describe('orderEmailSubject', () => {
  it('names the order and who placed it', () => {
    expect(orderEmailSubject(SETTINGS, order(), MEGAN)).toBe('Store order CS-0042 from Megan Bowen');
  });

  it('falls back to the email address when the name is blank', () => {
    expect(orderEmailSubject(SETTINGS, order(), { name: '', email: 'megan@contoso.com' }))
      .toBe('Store order CS-0042 from megan@contoso.com');
  });
});

describe('orderEmailBody', () => {
  it('opens with who placed which order', () => {
    expect(linesOf(orderEmailBody(SETTINGS, order(), MEGAN, ORDERS_URL))[0]).toBe('Megan Bowen placed order CS-0042.');
  });

  it('lists each item with how many, the size only when there is a choice, and the total', () => {
    const lines = linesOf(orderEmailBody(SETTINGS, order(), MEGAN, ORDERS_URL));
    const at = lines.indexOf('Qty');
    expect(lines.slice(at, at + 11)).toEqual([
      'Qty', 'Item', 'Price',
      '2', 'Hoodie (Large)', '$44.00',
      '3', 'Sticker', 'Free',
      'Total', '$44.00'
    ]);
    expect(lines).not.toContain('Nothing to pay.');
  });

  it('says there is nothing to pay when everything is free', () => {
    const free = order({ total: 0, lines: [{ productId: 2, name: 'Sticker', price: 0, qty: 3, variant: ONE_SIZE }] });
    const lines = linesOf(orderEmailBody(SETTINGS, free, MEGAN, ORDERS_URL));
    expect(lines).toContain('Nothing to pay.');
    expect(lines[lines.indexOf('Total') + 1]).toBe('Free');
  });

  it('shows the price in the store currency', () => {
    const lines = linesOf(orderEmailBody({ ...SETTINGS, currency: 'EUR' }, order(), MEGAN, ORDERS_URL));
    expect(lines).toContain('€44.00');
  });

  it('gives the pick-up instructions for a pick-up order', () => {
    const lines = linesOf(orderEmailBody(SETTINGS, order(), MEGAN, ORDERS_URL));
    expect(lines).toContain('Pick up at the office');
    expect(lines).toContain(SETTINGS.pickUpNote);
    expect(lines).not.toContain('Delivery');
  });

  it('gives the address, line by line, and the phone number for a delivery', () => {
    const body = orderEmailBody(SETTINGS, deliveryOrder(), MEGAN, ORDERS_URL);
    const lines = linesOf(body);
    expect(lines).toContain('Delivery');
    expect(lines).not.toContain('Pick up at the office');
    expect(body).toContain('Megan Bowen<br>Havnegade 4<br>1058 Copenhagen<br>Denmark');
    expect(lines).toContain('Phone: +45 1234 5678');
  });

  it('leaves the phone line out when there is no phone number', () => {
    const lines = linesOf(orderEmailBody(SETTINGS, { ...deliveryOrder(), phone: '' }, MEGAN, ORDERS_URL));
    expect(lines.filter(line => line.indexOf('Phone') === 0)).toEqual([]);
  });

  it('includes the buyer\'s note, keeping its line breaks, only when there is one', () => {
    const withNote = orderEmailBody(SETTINGS, order({ note: 'Gift for a new starter.\nNo rush.' }), MEGAN, ORDERS_URL);
    expect(linesOf(withNote)).toContain('Note from Megan Bowen');
    expect(withNote).toContain('Gift for a new starter.<br>No rush.');
    expect(linesOf(orderEmailBody(SETTINGS, order(), MEGAN, ORDERS_URL))).not.toContain('Note from Megan Bowen');
  });

  it('links to the orders list', () => {
    const body = orderEmailBody(SETTINGS, order(), MEGAN, ORDERS_URL);
    expect(body).toContain(`<a href="${ORDERS_URL}"`);
    expect(linesOf(body)).toContain('See the order in the orders list');
  });

  it('ends by saying who it was sent on behalf of', () => {
    const lines = linesOf(orderEmailBody(SETTINGS, order(), MEGAN, ORDERS_URL));
    expect(lines[lines.length - 1]).toBe('Sent by the company store on behalf of Megan Bowen.');
  });

  it('shows anything people typed as plain text, never as HTML', () => {
    const sneaky: IBuyer = { name: 'Megan <script>alert(1)</script>', email: 'megan@contoso.com' };
    const body = orderEmailBody(
      { ...SETTINGS, deliveryNote: 'Ask for <b>Ana</b>' },
      order({
        method: 'Delivery',
        note: '<img src=x onerror="alert(2)">',
        shipTo: 'Flat 2 & 3\n<a href="http://evil.example">Click</a>',
        phone: '"><script>',
        lines: [{ productId: 1, name: 'Mug <i>new</i>', price: 10, qty: 1, variant: '<u>Big</u>' }]
      }),
      sneaky,
      ORDERS_URL
    );
    expect(body).not.toMatch(/<script|<img|<b>|<i>|<u>|<a href="http:\/\/evil/);
    expect(body).toContain('Megan &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(body).toContain('Flat 2 &amp; 3');
    expect(linesOf(body)).toContain('Mug <i>new</i> (<u>Big</u>)');
  });
});

describe('orderEmailRequest', () => {
  it('goes to everyone set to get order emails, copies the buyer in, and keeps it in Sent Items', () => {
    const request = orderEmailRequest(SETTINGS, order(), MEGAN, ORDERS_URL);
    expect(request.message.subject).toBe('Store order CS-0042 from Megan Bowen');
    expect(request.message.body.contentType).toBe('HTML');
    expect(request.message.body.content).toBe(orderEmailBody(SETTINGS, order(), MEGAN, ORDERS_URL));
    expect(request.message.toRecipients).toEqual([
      { emailAddress: { address: 'store@contoso.com' } },
      { emailAddress: { address: 'hr@contoso.com' } }
    ]);
    expect(request.message.ccRecipients).toEqual([{ emailAddress: { address: 'megan@contoso.com' } }]);
    expect(request.saveToSentItems).toBe(true);
  });

  it('does not copy the buyer in when they already get order emails', () => {
    const settings = { ...SETTINGS, orderEmails: 'store@contoso.com; Megan@Contoso.com' };
    const request = orderEmailRequest(settings, order(), MEGAN, ORDERS_URL);
    expect(request.message.toRecipients.map(r => r.emailAddress.address))
      .toEqual(['store@contoso.com', 'Megan@Contoso.com']);
    expect(request.message.ccRecipients).toEqual([]);
  });

  it('does not copy the buyer in when there is no email address for them', () => {
    const request = orderEmailRequest(SETTINGS, order(), { name: 'Megan Bowen', email: '' }, ORDERS_URL);
    expect(request.message.ccRecipients).toEqual([]);
  });

  it('sends one copy to an address that is on the list twice', () => {
    const settings = { ...SETTINGS, orderEmails: 'store@contoso.com, Store@contoso.com' };
    expect(orderEmailRequest(settings, order(), MEGAN, ORDERS_URL).message.toRecipients).toHaveLength(1);
  });

  it('refuses when no one is set to get order emails', () => {
    expect(() => orderEmailRequest({ ...SETTINGS, orderEmails: ' , ' }, order(), MEGAN, ORDERS_URL))
      .toThrow(NO_ONE_TO_EMAIL);
  });
});

describe('whyEmailFailed', () => {
  it('blames the missing approval when Graph refuses', () => {
    expect(whyEmailFailed(graphError(403, 'ErrorAccessDenied', 'Access is denied. Check credentials and try again.')))
      .toBe(NOT_APPROVED);
  });

  it('blames the missing approval when sign-in says no one has consented', () => {
    expect(whyEmailFailed(new Error(
      "AADSTS65001: The user or administrator has not consented to use the application with ID '08e18876'. " +
      'Trace ID: 1234 Correlation ID: 5678'
    ))).toBe(NOT_APPROVED);
  });

  it('blames the missing approval for the other ways Graph says it', () => {
    expect(whyEmailFailed(graphError(401, 'Authorization_RequestDenied', 'Request denied.'))).toBe(NOT_APPROVED);
    expect(whyEmailFailed(new Error('Insufficient privileges to complete the operation.'))).toBe(NOT_APPROVED);
  });

  it('passes on a short reason for anything else', () => {
    expect(whyEmailFailed(graphError(404, 'MailboxNotEnabledForRESTAPI',
      'The mailbox is either inactive, soft-deleted, or is hosted on-premise.')))
      .toBe("The order email couldn't be sent. The mailbox is either inactive, soft-deleted, or is hosted on-premise.");
  });

  it('keeps only the first sentence of a long reason', () => {
    expect(whyEmailFailed(new Error(
      'AADSTS50058: A silent sign-in request was sent but no user is signed in. Trace ID: 1234 Correlation ID: 5678'
    ))).toBe("The order email couldn't be sent. AADSTS50058: A silent sign-in request was sent but no user is signed in.");
  });

  it('says only that it could not be sent when there is no readable reason', () => {
    expect(whyEmailFailed(new Error('{"error":{"code":"x"}}'))).toBe(NOT_SENT);
    expect(whyEmailFailed(new Error(''))).toBe(NOT_SENT);
    expect(whyEmailFailed(undefined)).toBe(NOT_SENT);
  });

  it('can say it was just "the email" for emails that are not the order email', () => {
    expect(whyEmailFailed(new Error('The mailbox is full.'), EMAIL_NOT_SENT))
      .toBe("The email couldn't be sent. The mailbox is full.");
    expect(whyEmailFailed(undefined, EMAIL_NOT_SENT)).toBe("The email couldn't be sent.");
    expect(whyEmailFailed(graphError(403, 'ErrorAccessDenied', 'Access is denied.'), EMAIL_NOT_SENT)).toBe(NOT_APPROVED);
  });
});

describe('uniqueEmails', () => {
  it('keeps each address once, as first written, whatever the capitals', () => {
    expect(uniqueEmails(['Store@contoso.com', 'hr@contoso.com', 'store@Contoso.com']))
      .toEqual(['Store@contoso.com', 'hr@contoso.com']);
  });
});
