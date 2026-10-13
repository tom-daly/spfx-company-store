import * as React from 'react';
import { TextField } from '@fluentui/react';
import type { IAddress } from '../../store/types';
import { ADDRESS } from '../../strings/checkout';

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
  { key: 'name', label: ADDRESS.name, maxLength: 255, autoComplete: 'name', full: true },
  {
    key: 'line1', label: ADDRESS.line1, placeholder: ADDRESS.line1Placeholder, maxLength: 255,
    autoComplete: 'address-line1', full: true
  },
  {
    key: 'line2', label: ADDRESS.line2, placeholder: ADDRESS.line2Placeholder, maxLength: 255,
    autoComplete: 'address-line2', full: true
  },
  { key: 'postcode', label: ADDRESS.postcode, maxLength: 20, autoComplete: 'postal-code' },
  { key: 'city', label: ADDRESS.city, maxLength: 100, autoComplete: 'address-level2' },
  { key: 'country', label: ADDRESS.country, maxLength: 100, autoComplete: 'country-name' },
  {
    key: 'phone', label: ADDRESS.phone, placeholder: ADDRESS.phonePlaceholder, maxLength: 40, type: 'tel',
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
        errorMessage={missing.indexOf(b.key) > -1 ? ADDRESS.needed : undefined} disabled={disabled}
      />
    ))}
  </div>
);

export default AddressFields;
