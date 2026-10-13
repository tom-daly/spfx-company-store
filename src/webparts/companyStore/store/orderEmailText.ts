/*
 * The order email itself: its subject, its body, who it goes to, and what to
 * tell people when it can't be sent. Kept free of SharePoint and Graph so it
 * can be tested on its own; orderEmail.ts does the sending. The status emails
 * (statusEmailText.ts) borrow its look, its building blocks and its items table.
 */
import { formatMoney, splitEmails } from './settings';
import type { IStoreSettings } from './settings';
import type { IBuyer, ICartLine, IPlacedOrder } from './types';
import { displayName, fillInsFor, message } from './messages';
import { lineName } from './orderText';

export const NO_ONE_TO_EMAIL: string = 'No one is set to get order emails yet.';
export const NOT_APPROVED: string = "IT hasn't approved the store sending email yet, so no email went.";
export const NOT_SENT: string = "The order email couldn't be sent.";
/** The same, for the emails to the person who ordered. */
export const EMAIL_NOT_SENT: string = "The email couldn't be sent.";

/** Makes text that people typed safe to put in the email, so it shows as typed and can't add links or code. */
export function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escapes, and keeps the line breaks people typed (addresses, notes). */
export const withBreaks = (text: string): string =>
  escapeHtml(text.trim()).replace(/\r\n|\r|\n/g, '<br>');

const sameAddress = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/** Each address once, however it was capitalised, as first written. */
export function uniqueEmails(addresses: string[]): string[] {
  const kept: string[] = [];
  for (const address of addresses) {
    if (!kept.some(a => sameAddress(a, address))) kept.push(address);
  }
  return kept;
}

/** A subject as it goes out: on one line, single spaces, nothing at either end. */
export const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();

export function orderEmailSubject(settings: IStoreSettings, order: IPlacedOrder, buyer: IBuyer): string {
  return oneLine(message(settings, 'emailSubject', fillInsFor(order, buyer, settings.currency)));
}

/* -------------------------------------------------------------- body */

/*
 * Inline styles and plain tables only: Outlook on Windows ignores style sheets
 * and most modern layout, so this is what shows the same everywhere.
 */
const FONT: string = "font-family:'Segoe UI',Helvetica,Arial,sans-serif;";
const TEXT: string = `${FONT}font-size:14px;line-height:20px;color:#242424;`;
const PARA: string = `margin:0 0 16px 0;${TEXT}`;
const LABEL: string = `margin:24px 0 4px 0;${FONT}font-size:14px;line-height:20px;font-weight:bold;color:#242424;`;
const MUTED: string = 'color:#616161;';
const CELL: string = `padding:8px;border-bottom:1px solid #e0e0e0;vertical-align:top;${TEXT}`;
const HEAD_CELL: string = `padding:8px;border-bottom:2px solid #c7c7c7;font-weight:bold;${TEXT}`;
const TOTAL_CELL: string = `padding:8px;font-weight:bold;${TEXT}`;
const FOOTER: string = `margin:32px 0 0 0;padding-top:12px;border-top:1px solid #e0e0e0;${FONT}font-size:12px;line-height:16px;${MUTED}`;
const LINK: string = 'color:#0f6cbd;';

/** How the store's emails look, so the status emails match this one. */
export const EMAIL_STYLE: { para: string; label: string; footer: string; link: string } = {
  para: PARA, label: LABEL, footer: FOOTER, link: LINK
};

/** A paragraph of text, line breaks kept. Nothing when there is no text. */
export const paragraph = (text: string): string => (text ? `<p style="${PARA}">${withBreaks(text)}</p>` : '');

/** The same in grey, for the store's own notes. */
export const quietParagraph = (text: string): string =>
  (text ? `<p style="${PARA}${MUTED}">${withBreaks(text)}</p>` : '');

/** A paragraph holding one link, set a little apart from what's above it. */
export const linkParagraph = (href: string, words: string): string =>
  `<p style="${PARA}margin-top:24px;"><a href="${escapeHtml(href)}" style="${LINK}">${escapeHtml(words)}</a></p>`;

/** The whole body: the opening words, if any, then the rest, all in the store's type. */
export const emailBody = (opening: string, rest: string): string =>
  `<div style="${TEXT}">${paragraph(opening)}${rest}</div>`;

/** What was ordered, as a table with the total under it, and "Nothing to pay." when it's all free. */
export function itemsAndTotal(lines: ICartLine[], total: number, settings: IStoreSettings): string {
  const rows = lines.map((line): string => '<tr>' +
    `<td style="${CELL}">${escapeHtml(String(line.qty))}</td>` +
    `<td style="${CELL}">${escapeHtml(lineName(line))}</td>` +
    `<td align="right" style="${CELL}white-space:nowrap;">${escapeHtml(formatMoney(line.price * line.qty, settings.currency))}</td>` +
    '</tr>');
  return '<table cellpadding="0" cellspacing="0" border="0" width="100%" ' +
      'style="border-collapse:collapse;width:100%;max-width:560px;">' +
    '<tr>' +
      `<th align="left" style="${HEAD_CELL}width:48px;">Qty</th>` +
      `<th align="left" style="${HEAD_CELL}">Item</th>` +
      `<th align="right" style="${HEAD_CELL}">Price</th>` +
    '</tr>' +
    rows.join('') +
    '<tr>' +
      `<td style="${TOTAL_CELL}"></td>` +
      `<td style="${TOTAL_CELL}">Total</td>` +
      `<td align="right" style="${TOTAL_CELL}white-space:nowrap;">${escapeHtml(formatMoney(total, settings.currency))}</td>` +
    '</tr>' +
    '</table>' +
    (total === 0 ? `<p style="${PARA}margin-top:12px;">Nothing to pay.</p>` : '');
}

function howTheyWantIt(order: IPlacedOrder, settings: IStoreSettings): string {
  if (order.method === 'Pick up') {
    const note = (settings.pickUpNote || '').trim();
    return `<p style="${LABEL}">Pick up at the office</p>` + quietParagraph(note);
  }
  const note = (settings.deliveryNote || '').trim();
  const phone = (order.phone || '').trim();
  const address = [
    (order.shipTo || '').trim() ? withBreaks(order.shipTo) : '',
    phone ? `Phone: ${escapeHtml(phone)}` : ''
  ].filter(Boolean).join('<br>');
  return `<p style="${LABEL}">Delivery</p>` +
    quietParagraph(note) +
    (address ? `<p style="${PARA}">${address}</p>` : '');
}

/** Everything after the opening: items, how they want it, their note, the link. Also shown in Customize. */
export function orderEmailDetails(
  settings: IStoreSettings, order: IPlacedOrder, buyer: IBuyer, ordersUrl: string
): string {
  const who = escapeHtml(displayName(buyer));
  const note = (order.note || '').trim();
  return itemsAndTotal(order.lines, order.total, settings) +
    howTheyWantIt(order, settings) +
    (note ? `<p style="${LABEL}">Note from ${who || 'the buyer'}</p>` + paragraph(note) : '') +
    (ordersUrl ? linkParagraph(ordersUrl, 'See the order in the orders list') : '') +
    `<p style="${FOOTER}">Sent by the company store${who ? ` on behalf of ${who}` : ''}.</p>`;
}

/** The email body as HTML. Everything people typed is escaped. */
export function orderEmailBody(
  settings: IStoreSettings, order: IPlacedOrder, buyer: IBuyer, ordersUrl: string
): string {
  // The owner's opening words, filled in. Left out when they chose to have none.
  const opening = message(settings, 'emailMessage', fillInsFor(order, buyer, settings.currency)).trim();
  return emailBody(opening, orderEmailDetails(settings, order, buyer, ordersUrl));
}

/* ----------------------------------------------------------- request */

export interface IRecipient {
  /** The name is what the mail app shows; left out, it shows the address. */
  emailAddress: { address: string; name?: string };
}

/** What Graph's "send mail" takes. */
export interface ISendMailRequest {
  message: {
    subject: string;
    body: { contentType: 'HTML'; content: string };
    toRecipients: IRecipient[];
    ccRecipients: IRecipient[];
    /** Where replies go. Left out, they go back to whoever sent it. */
    replyTo?: IRecipient[];
  };
  saveToSentItems: boolean;
}

export const recipient = (address: string): IRecipient => ({ emailAddress: { address } });

/** One email for Graph to send, kept in the sender's Sent Items. */
export const sendMailRequest = (
  subject: string, content: string, to: IRecipient[], cc: IRecipient[]
): ISendMailRequest => ({
  message: {
    subject,
    body: { contentType: 'HTML', content },
    toRecipients: to,
    ccRecipients: cc
  },
  saveToSentItems: true
});

/**
 * The whole email, ready to send: to everyone in "Who gets order emails", with
 * the buyer copied in so it doubles as their confirmation. Throws if no one is
 * set to get it.
 */
export function orderEmailRequest(
  settings: IStoreSettings, order: IPlacedOrder, buyer: IBuyer, ordersUrl: string
): ISendMailRequest {
  const to = uniqueEmails(splitEmails(settings.orderEmails));
  if (!to.length) throw new Error(NO_ONE_TO_EMAIL);

  // The buyer already gets it if they are on the list; a second copy just confuses.
  const buyerEmail = (buyer.email || '').trim();
  const cc = buyerEmail && !to.some(a => sameAddress(a, buyerEmail)) ? [buyerEmail] : [];

  return sendMailRequest(
    orderEmailSubject(settings, order, buyer), orderEmailBody(settings, order, buyer, ordersUrl),
    to.map(recipient), cc.map(recipient)
  );
}

/* ------------------------------------------------------------ errors */

/*
 * Graph errors carry statusCode; other HTTP errors carry status. Sign-in
 * errors (the AADSTS ones) carry neither, only a message.
 */
function statusOf(e: unknown): number | undefined {
  if (!e || typeof e !== 'object') return undefined;
  const { statusCode, status } = e as { statusCode?: unknown; status?: unknown };
  if (typeof statusCode === 'number') return statusCode;
  if (typeof status === 'number') return status;
  return undefined;
}

function textOf(e: unknown): string {
  if (typeof e === 'string') return e;
  if (!e || typeof e !== 'object') return '';
  const { message, code, body } = e as { message?: unknown; code?: unknown; body?: unknown };
  return [code, message, body].filter(part => typeof part === 'string').join(' ');
}

/* The first sentence of what went wrong, if it reads like a sentence at all. */
function shortReason(e: unknown): string {
  const message = e && typeof e === 'object' ? (e as { message?: unknown }).message : e;
  const said = typeof message === 'string' ? message.replace(/\s+/g, ' ').trim() : '';
  if (!said || said.charAt(0) === '{' || said.charAt(0) === '<') return '';
  const first = said.match(/^.*?[.!?](?=\s|$)/);
  const sentence = first ? first[0] : said;
  if (sentence.length > 200) return '';
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

/* How the "not approved" refusal shows up: from the sign-in step or from Graph itself. */
const NOT_APPROVED_SIGNS: RegExp = /consent|AADSTS65001|Authorization_RequestDenied|insufficient privileges|ErrorAccessDenied/i;

/**
 * What to tell people when the email didn't go, in plain words. `notSent` is
 * how it starts: the order email's wording unless told otherwise.
 */
export function whyEmailFailed(e: unknown, notSent: string = NOT_SENT): string {
  if (statusOf(e) === 403 || NOT_APPROVED_SIGNS.test(textOf(e))) return NOT_APPROVED;
  const reason = shortReason(e);
  return reason ? `${notSent} ${reason}` : notSent;
}
