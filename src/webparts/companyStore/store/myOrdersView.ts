/*
 * The My orders page, minus SharePoint: what to tell someone about each of
 * their orders. Nothing in here talks to the site, so it can be tested on its own.
 */
import type { IStoreSettings } from './settings';
import type { DeliveryMethod, IBuyer } from './types';
import { IOrder, OrderStatus, statusesFor } from './ordersView';
import { dayText, whenText } from './dates';
import { itemText } from './orderText';
import { fillInsFor, message } from './messages';

/** Put after the store page's address, it opens My orders straight away. The status emails link there. */
export const MY_ORDERS_HASH = '#my-orders';

/** Whether the end of an address, like "#my-orders", asks for My orders. */
export const opensMyOrders = (hash: string): boolean => (hash || '').trim().toLowerCase() === MY_ORDERS_HASH;

/** The address without anything from # on. */
export const withoutHash = (href: string): string => href.split('#')[0];

/* ---------------------------------------------------------- the steps */

export type StepState = 'done' | 'current' | 'todo';

export interface IStep {
  status: OrderStatus;
  /** What the step is called on the page. */
  label: string;
  state: StepState;
}

/* "New" means something to the store team; to the person who ordered, it has been placed. */
const STEP_LABELS: Partial<Record<OrderStatus, string>> = { New: 'Placed' };

export const stepLabel = (status: OrderStatus): string => STEP_LABELS[status] || status;

/**
 * Every step an order going this way goes through, in order, each marked done,
 * the one it is at now, or still to come. A status that doesn't belong to the
 * way (which the orders page never lets through) counts as the first step.
 */
export function orderSteps(order: Pick<IOrder, 'method' | 'status'>): IStep[] {
  const steps = statusesFor(order.method);
  const at = Math.max(steps.indexOf(order.status), 0);
  return steps.map((status, i): IStep => ({
    status,
    label: stepLabel(status),
    state: i < at ? 'done' : i === at ? 'current' : 'todo'
  }));
}

/** Read out after a step's name. The step it is at now needs nothing: the page marks it as the current one. */
export const stepStateText = (state: StepState): string =>
  state === 'done' ? 'done' : state === 'todo' ? 'still to come' : '';

/* ------------------------------------------------------- where it's at */

/**
 * When the store said it would be ready, like "Ready for pick-up by Thu 15 Oct
 * 2026." or, for a delivery, "We expect to send it by Thu 15 Oct 2026." The
 * status emails say it the same way.
 */
export const readyByText = (method: DeliveryMethod, day: string): string =>
  method === 'Pick up' ? `Ready for pick-up by ${day}.` : `We expect to send it by ${day}.`;

/** One line on where the order has got to. */
export function whereItsAt(order: Pick<IOrder, 'method' | 'status' | 'readyBy' | 'pickedUpOn'>): string {
  const pickUp = order.method === 'Pick up';
  switch (order.status) {
    case 'Confirmed': {
      const by = dayText(order.readyBy);
      if (by) return `Confirmed. ${readyByText(order.method, by)}`;
      return pickUp
        ? "Confirmed. We're working on it and will email you when it's ready."
        : "Confirmed. We're working on it and will email you when it's on its way.";
    }
    case 'Packed':
      return 'Packed and waiting to be sent.';
    case 'Ready for pick-up':
      return 'Ready for pick-up.';
    case 'Shipped':
      return 'On its way.';
    case 'Picked up': {
      const on = dayText(order.pickedUpOn);
      return on ? `Picked up on ${on}.` : 'Picked up.';
    }
    default:
      return "We've got your order. We'll confirm it soon.";
  }
}

/**
 * The store's pick-up instructions, fill-ins and all, for an order waiting to
 * be picked up. Empty for any other order, or when the store hasn't written any.
 */
export function pickUpNoteFor(
  order: Pick<IOrder, 'number' | 'total' | 'status'>, settings: IStoreSettings, buyer: IBuyer
): string {
  if (order.status !== 'Ready for pick-up') return '';
  return message(settings, 'pickUpNote', fillInsFor(order, buyer, settings.currency)).trim();
}

/* ----------------------------------------------------------- the order */

/** What was ordered, one line each, like "2 × T-shirt (M)". Falls back to the Items column when the order data can't be read. */
export const itemTexts = (order: Pick<IOrder, 'lines' | 'itemLines'>): string[] =>
  order.lines.length ? order.lines.map(itemText) : order.itemLines;

/** "Placed 4 Oct 2026 at 3:30 PM", or empty when SharePoint's date couldn't be read. */
export const placedText = (order: Pick<IOrder, 'placed'>): string =>
  order.placed ? `Placed ${whenText(order.placed)}` : '';
