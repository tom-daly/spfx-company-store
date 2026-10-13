import * as React from 'react';
import { TextField } from '@fluentui/react';
import type { IAddress } from '../../store/types';

interface IAddressBox {
  key: keyof IAddress;
  label: string;
  placeholder?: string;
  maxLength: number;
  type?: string;
  /** The browser's name for it, so it can fill it in. */
  autoComplete: string;
  /** Takes the whole width of the form. */
  full?: boolean;
}

const BOXES: IAddressBox[] = [
  { key: 'name', label: 'Full name', maxLength: 255, autoComplete: 'name', full: true },
  {
    key: 'line1', label: 'Address line 1', placeholder: 'Street and number', maxLength: 255,
    autoComplete: 'address-line1', full: true
  },
  {
    key: 'line2', label: 'Address line 2', placeholder: 'Optional', maxLength: 255,
    autoComplete: 'address-line2', full: true
  },
  { key: 'postcode', label: 'Postcode', maxLength: 20, autoComplete: 'postal-code' },
  { key: 'city', label: 'City', maxLength: 100, autoComplete: 'address-level2' },
  { key: 'country', label: 'Country', maxLength: 100, autoComplete: 'country-name' },
  {
    key: 'phone', label: 'Phone', placeholder: 'For the courier (optional)', maxLength: 40, type: 'tel',
    autoComplete: 'tel'
  }
];

export interface IAddressFieldsProps {
  address: IAddress;
  onChange: (key: keyof IAddress, value: string) => void;
  /** The parts to mark "Needed for delivery". */
  missing: (keyof IAddress)[];
  disabled?: boolean;
  /** Lets the browser fill the boxes in. At checkout only: in the editor it's somebody else's address. */
  autoFill?: boolean;
  /** The grid the boxes sit in, from the page they're on. */
  className?: string;
  /** For the boxes that take the whole width of the grid. */
  fullClassName?: string;
}

/* The seven boxes of a delivery address, shared by checkout and the order editor. */
const AddressFields: React.FC<IAddressFieldsProps> = (
  { address, onChange, missing, disabled, autoFill, className, fullClassName }
) => (
  <div className={className}>
    {BOXES.map(b => (
      <TextField
        key={b.key} className={b.full ? fullClassName : undefined} label={b.label} placeholder={b.placeholder}
        type={b.type} autoComplete={autoFill ? b.autoComplete : undefined} maxLength={b.maxLength}
        value={address[b.key]} onChange={(_, value) => onChange(b.key, value || '')}
        errorMessage={missing.indexOf(b.key) > -1 ? 'Needed for delivery' : undefined} disabled={disabled}
      />
    ))}
  </div>
);

export default AddressFields;
