import type { MessageBarType } from '@fluentui/react';

/** A message for a message bar: what kind it is, and the words. */
export interface INotice {
  type: MessageBarType;
  text: string;
}
