import type { IDropdownOption } from '@fluentui/react';
import type { DeliveryMethod } from '../../store/types';
import { statusesFor } from '../../store/ordersView';

const optionsFor = (method: DeliveryMethod): IDropdownOption[] =>
  statusesFor(method).map(s => ({ key: s, text: s }));

/** The status choices for each way: a pick-up is never Packed or Shipped. */
export const STATUS_OPTIONS: Record<DeliveryMethod, IDropdownOption[]> = {
  Delivery: optionsFor('Delivery'),
  'Pick up': optionsFor('Pick up')
};
