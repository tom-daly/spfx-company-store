/*
 * The emails to the person who ordered, sent as the store moves their order
 * on: confirmed, ready for pick-up, on its way. Kept free of SharePoint and
 * Graph so it can be tested on its own; statusEmail.ts does the sending. They
 * look like the order email and share its items table.
 */
import { formatMoney, splitEmails } from './settings';
import type { IStoreSettings } from './settings';
import type { IOrder, OrderStatus } from './ordersView';
import {
  EMAIL_STYLE, emailBody, escapeHtml, itemsAndTotal, linkParagraph, oneLine, paragraph, quietParagraph, recipient,
  sendMailRequest, uniqueEmails
} from './orderEmailText';
import type { IRecipient, ISendMailRequest } from './orderEmailText';
import { fillInsFor, message } from './messages';
import type { IFillIns, MessageKey } from './messages';
import { dayText } from './dates';
import { MY_ORDERS_HASH, readyByText, withoutHash } from './myOrdersView';
import { trackingFor, trackingLabel } from './tracking';

export type StatusEmailKind = 'confirmed' | 'ready' | 'shipped';

/** The email that goes with moving an order to this status, if there is one. */
export function emailFor(status: OrderStatus): StatusEmailKind | undefined {
  if (status === 'Confirmed') return 'confirmed';
  if (status === 'Ready for pick-up') return 'ready';
  if (status === 'Shipped') return 'shipped';
  return undefined;
}

/** The owner's words each email uses, edited in Customize. */
export const STATUS_EMAIL_WORDING: Record<StatusEmailKind, { subject: MessageKey; message: MessageKey }> = {
  confirmed: { subject: 'confirmedSubject', message: 'confirmedMessage' },
  ready: { subject: 'readySubject', message: 'readyMessage' },
  shipped: { subject: 'shippedSubject', message: 'shippedMessage' }
};

/* {first name} and {name} are the person who placed the order. */
const statusFillIns = (settings: IStoreSettings, order: IOrder): IFillIns =>
  fillInsFor({ number: order.number, total: order.total }, { name: order.who, email: order.email }, settings.currency);

export function statusEmailSubject(settings: IStoreSettings, kind: StatusEmailKind, order: IOrder): string {
  return oneLine(message(settings, STATUS_EMAIL_WORDING[kind].subject, statusFillIns(settings, order)));
}

/** The owner's opening words, filled in, as plain text. Empty when they chose to have none. */
export function statusEmailOpening(settings: IStoreSettings, kind: StatusEmailKind, order: IOrder): string {
  return message(settings, STATUS_EMAIL_WORDING[kind].message, statusFillIns(settings, order)).trim();
}

/** What to say when an order has no email address to send to. */
export const noEmailAddress = (who: string): string =>
  `There's no email address for ${(who || '').trim() || 'whoever placed it'}, so no email went.`;

/* -------------------------------------------------------------- body */

const { para: PARA, label: LABEL, footer: FOOTER, link: LINK } = EMAIL_STYLE;

/* "Ready for pick-up by Thu 15 Oct 2026." Nothing when the store hasn't said a day. */
function whenReady(order: IOrder): string {
  const day = dayText(order.readyBy);
  return day ? paragraph(readyByText(order.method, day)) : '';
}

function howToPickUp(settings: IStoreSettings): string {
  const note = (settings.pickUpNote || '').trim();
  return note ? `<p style="${LABEL}">Pick up at the office</p>` + quietParagraph(note) : '';
}

/* "USPS tracking: 9400…" linked to the carrier's page, a pasted web address linked as it is, or plain text. */
function tracking(order: IOrder): string {
  const t = trackingFor(order.tracking);
  if (!t) return '';
  const shown = t.href
    ? `<a href="${escapeHtml(t.href)}" style="${LINK}word-break:break-all;">${escapeHtml(t.text)}</a>`
    : escapeHtml(t.text);
  return `<p style="${PARA}">${escapeHtml(trackingLabel(t))}: ${shown}</p>`;
}

function sentTo(order: IOrder): string {
  const lines = order.shipTo.map(l => l.trim()).filter(Boolean);
  return lines.length
    ? `<p style="${LABEL}">Sent to</p><p style="${PARA}">${lines.map(l => escapeHtml(l)).join('<br>')}</p>`
    : '';
}

/* What's new about the order, under the opening. */
function whatsNew(settings: IStoreSettings, kind: StatusEmailKind, order: IOrder): string {
  if (kind === 'confirmed') return whenReady(order);
  if (kind === 'ready') return howToPickUp(settings);
  return tracking(order) + sentTo(order);
}

/*
 * The items table, or, for an order whose order data can't be read, the Items
 * column line by line with the total under it.
 */
function whatTheyOrdered(settings: IStoreSettings, order: IOrder): string {
  if (order.lines.length) {
    return `<p style="${LABEL}">What you ordered</p>` + itemsAndTotal(order.lines, order.total, settings);
  }
  const items = order.itemLines.map(l => l.trim()).filter(Boolean);
  if (!items.length) return '';
  return `<p style="${LABEL}">What you ordered</p>` +
    `<p style="${PARA}">${items.map(l => escapeHtml(l)).join('<br>')}</p>` +
    `<p style="${PARA}font-weight:bold;">Total: ${escapeHtml(formatMoney(order.total, settings.currency))}</p>`;
}

function myOrdersLink(storeUrl: string): string {
  // The link brings its own #, so anything after one already there would break it.
  const page = withoutHash(storeUrl || '').trim();
  return page ? linkParagraph(page + MY_ORDERS_HASH, 'See your orders') : '';
}

/** Everything after the opening: what's new, what they ordered, the link, the footer. Also shown in Customize. */
export function statusEmailDetails(
  settings: IStoreSettings, kind: StatusEmailKind, order: IOrder, storeUrl: string
): string {
  return whatsNew(settings, kind, order) +
    whatTheyOrdered(settings, order) +
    myOrdersLink(storeUrl) +
    `<p style="${FOOTER}">Sent by the company store. Reply to this email if you have any questions.</p>`;
}

/** The email body as HTML. Everything people typed is escaped. */
export function statusEmailBody(
  settings: IStoreSettings, kind: StatusEmailKind, order: IOrder, storeUrl: string
): string {
  return emailBody(statusEmailOpening(settings, kind, order), statusEmailDetails(settings, kind, order, storeUrl));
}

/* ----------------------------------------------------------- request */

/**
 * The whole email, ready for Graph: to the person who placed the order, with
 * replies going to the store's order email addresses. `storeUrl` is the store
 * page, for the link to their orders. Throws if there's no address to send to.
 */
export function statusEmailRequest(
  settings: IStoreSettings, kind: StatusEmailKind, order: IOrder, storeUrl: string
): ISendMailRequest {
  const address = (order.email || '').trim();
  if (!address) throw new Error(noEmailAddress(order.who));

  const to: IRecipient = recipient(address);
  const name = (order.who || '').trim();
  if (name) to.emailAddress.name = name;

  const request: ISendMailRequest = sendMailRequest(
    statusEmailSubject(settings, kind, order), statusEmailBody(settings, kind, order, storeUrl), [to], []
  );
  // With no store addresses set, replies go back to whoever moved the order on.
  const replyTo = uniqueEmails(splitEmails(settings.orderEmails));
  if (replyTo.length) request.message.replyTo = replyTo.map(recipient);
  return request;
}
