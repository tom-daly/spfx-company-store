import type { MSGraphClientV3 } from '@microsoft/sp-http';
import type { IStoreSettings } from './settings';
import type { IBuyer, IPlacedOrder } from './types';
import { orderEmailRequest, whyEmailFailed } from './orderEmailText';
import type { ISendMailRequest } from './orderEmailText';

/** Gets a Microsoft Graph client signed in as the person looking at the page. */
export type GetGraph = () => Promise<MSGraphClientV3>;

/**
 * Sends an email from the mailbox of the person looking at the page. Throws
 * with a plain-words message if it could not be sent, starting with `notSent`
 * (the order email's own words when left out).
 */
export async function sendMail(getGraph: GetGraph, request: ISendMailRequest, notSent?: string): Promise<void> {
  try {
    const graph = await getGraph();
    await graph.api('/me/sendMail').post(request);
  } catch (e) {
    throw new Error(whyEmailFailed(e, notSent));
  }
}

/**
 * Sends the order email from the buyer's own mailbox to the addresses in the
 * store settings, with the buyer copied in. It lands in their Sent Items too.
 * Throws with a plain-words message if it could not be sent; the order itself
 * is already saved by then and stays saved.
 *
 * Needs the Graph Mail.Send permission, which a SharePoint admin approves once
 * for the whole organisation. Until then this throws the "IT hasn't approved"
 * message.
 */
export async function sendOrderEmail(
  getGraph: GetGraph, settings: IStoreSettings, order: IPlacedOrder, buyer: IBuyer, ordersUrl: string
): Promise<void> {
  // Built before anything is sent, so "no one is set to get order emails" is
  // reported as that and not as a failed send.
  const request = orderEmailRequest(settings, order, buyer, ordersUrl);
  await sendMail(getGraph, request);
}
