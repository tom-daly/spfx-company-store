import type { IStoreSettings } from './settings';
import type { IOrder } from './ordersView';
import { GetGraph, sendMail } from './orderEmail';
import { EMAIL_NOT_SENT } from './orderEmailText';
import { StatusEmailKind, statusEmailRequest } from './statusEmailText';

/**
 * Tells the person who placed the order that it moved on, from the mailbox of
 * whoever is moving it (it lands in their Sent Items). Replies go to the store's
 * order email addresses. Throws with a plain-words message if it could not be
 * sent; the status change is already saved by then and stays saved.
 */
export async function sendStatusEmail(
  getGraph: GetGraph, settings: IStoreSettings, kind: StatusEmailKind, order: IOrder, storeUrl: string
): Promise<void> {
  // Built before anything is sent, so a missing address is reported as that and not as a failed send.
  const request = statusEmailRequest(settings, kind, order, storeUrl);
  await sendMail(getGraph, request, EMAIL_NOT_SENT);
}
