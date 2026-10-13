/*
 * The shapes the shop, the cart, checkout and the order email share. Each part
 * is built separately against these, so change them only with care.
 */

/** One choice within an option, like "White" within Colour. */
export interface IOptionValue {
  value: string;
  /** Its own photos, in order, shown when it's picked. Empty or missing when it has none. */
  photoUrls?: string[];
}

/** Something a product varies by, like Size or Colour. Up to three per product. */
export interface IOption {
  name: string;
  values: IOptionValue[];
}

/** One combination of choices, like White · M, with its own stock and maybe its own price. */
export interface IVariant {
  /** Its row in the stock list, once there is one. */
  stockId?: number;
  /** "White · M", or "One size" for a product with no options. Also the stock row's title. */
  label: string;
  /** Which value of each option, like { Colour: 'White', Size: 'M' }. Empty for "One size". */
  combo: Record<string, string>;
  inStock: number;
  /** What it costs: its own price, or the product's when it has none. */
  price: number;
  /** Its own price, when it has one. */
  ownPrice?: number;
}

/** A product as the shop shows it: the product row joined to its stock lines. */
export interface IProduct {
  id: number;
  name: string;
  productCode: string;
  shortDescription: string;
  longDescription: string;
  /** The Details column split into lines, like "Fabric: organic cotton". */
  details: string[];
  /** The product's own price, used by any variant without one of its own. */
  price: number;
  /** Full URL of the cover photo (the first of photos), or undefined when there is none. */
  photoUrl?: string;
  /** All the product's own photos, cover first. Empty when there are none. */
  photos: string[];
  searchWords: string[];
  /** The Active column. Inactive products never show in the shop. */
  active: boolean;
  /** How many are left across all variants. Undefined when there is no stock line yet — treat as none. */
  inStock?: number;
  /** What it varies by. Empty for a product that comes one way only. */
  options: IOption[];
  /** Every combination, each with its stock and price. One "One size" variant when there are no options. */
  variants: IVariant[];
}

/* The label of the one variant a product with no options has. */
export const ONE_SIZE = 'One size';

export interface ICartLine {
  productId: number;
  name: string;
  price: number;
  qty: number;
  photoUrl?: string;
  /** Which variant: its label, like "White · M" or "One size". Matches the stock row's title. */
  variant: string;
}

export type DeliveryMethod = 'Pick up' | 'Delivery';

export interface IAddress {
  /** Full name, as it goes on the parcel. */
  name: string;
  line1: string;
  line2: string;
  postcode: string;
  city: string;
  country: string;
  phone: string;
}

export interface IOrderRequest {
  lines: ICartLine[];
  method: DeliveryMethod;
  /** Required when method is Delivery. */
  address?: IAddress;
  note: string;
  /** Keep the address on file for next time. */
  rememberAddress: boolean;
}

export interface IPlacedOrder {
  /** The row in the orders list. */
  id: number;
  /** What people see, like CS-0042. */
  number: string;
  total: number;
  lines: ICartLine[];
  method: DeliveryMethod;
  /** The address as written on the order, one line per row. Empty for pick-up. */
  shipTo: string;
  phone: string;
  note: string;
}

/** The person placing the order. */
export interface IBuyer {
  name: string;
  email: string;
}
