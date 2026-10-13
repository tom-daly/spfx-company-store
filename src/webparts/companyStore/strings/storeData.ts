/*
 * Messages from loading and saving the store's data: the lists not being set
 * up, too many people changing the same thing at once, and saves or uploads
 * that didn't go through. A reason in brackets is SharePoint's own words.
 */

// When the store's lists, or who the person is, can't be found.
export const STORE_DATA = {
  listsNotSetUp: 'The store lists are not set up.',
  whoAreYou: 'We couldn\'t tell who you are, so we can\'t look up your address.'
};

// Placing an order, when the stock or the order doesn't go in.
export const PLACING_ORDER = {
  // An order's title until it has its number. Only seen if numbering and the clean-up both fail.
  notPlacedYet: 'Not placed yet',
  // Someone else kept changing the same stock at the same moment.
  busy: (item: string): string => `Lots of people are ordering ${item} right now. Please try again in a moment.`,
  stockFailed: (item: string, reason: string): string =>
    `We couldn't take ${item} off the stock list, so nothing has been ordered. Please try again. (${reason})`,
  saveFailed: (reason: string): string =>
    `Your order couldn't be saved, so nothing has been ordered. Please try again. (${reason})`
};

// Lines saved in an order's history when it is placed and its email goes, or doesn't.
export const PLACED_HISTORY = {
  placed: 'Order placed',
  emailSent: 'Confirmation email sent',
  // `why` is empty when there is nothing more to say than that.
  emailFailed: (why: string): string =>
    why ? `The confirmation email couldn't be sent: ${why}` : 'The confirmation email couldn\'t be sent'
};

// Saving an owner's changes to an order, when the stock or the order doesn't change.
export const SAVING_ORDER = {
  stockFailed: (item: string, reason: string): string =>
    `The stock for ${item} couldn't be changed, so the order is as it was. Please try again. (${reason})`,
  saveFailed: (reason: string): string =>
    `The changes couldn't be saved, so the order is as it was. Please try again. (${reason})`
};

// Saving a product, when the product went in but some of what goes with it didn't.
export const SAVING_PRODUCT = {
  // What didn't go in, lower case, as it sits in the middle of `partlySaved`.
  photo: (fileName: string): string => `the photo ${fileName}`,
  photoFor: (fileName: string, choice: string): string => `the photo ${fileName} for ${choice}`,
  newPhotos: 'the new photos',
  // One of those, with SharePoint's reason.
  withReason: (what: string, reason: string): string => `${what} (${reason})`,
  // More than one photo, with the first one's reason.
  somePhotos: (count: number, reason: string): string => `${count} of the new photos (${reason})`,
  stock: (reason: string): string => `the stock numbers (${reason})`,
  partlySaved: (product: string, problems: string[]): string =>
    `${product} was saved, but ${problems.join(' and ')} didn't go in. ` +
    'Save again to try once more, or fix it in the Products or Stock list.'
};

// Drawing the sample products' pictures in the browser.
export const SAMPLE_PICTURES = {
  cannotDraw: 'This browser cannot draw the sample pictures.',
  didNotDraw: 'The sample picture did not draw.'
};
