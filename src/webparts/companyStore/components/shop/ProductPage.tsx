import * as React from 'react';
import { css } from '@fluentui/react';
import styles from './Shop.module.scss';
import { ICartLine, IOption, IOptionValue, IProduct, IVariant, ONE_SIZE } from '../../store/types';
import { Combo, dropSoldOut, findVariant, leftFor } from '../../store/variants';
import { Currency, formatMoney } from '../../store/settings';
import { addButtonText, pickNote, priceText, splitDetail, stockLabel, stockLeft } from '../../store/shopText';
import { IGalleryPicture, galleryFor } from '../../store/gallery';
import Gallery from './Gallery';
import Stepper from './Stepper';
import BackArrow from '../BackArrow';

export interface IProductPageProps {
  product: IProduct;
  currency: Currency;
  /** This product's lines in the cart, one per variant. */
  inCart: ICartLine[];
  onBack: () => void;
  onAdd: (variant: IVariant, qty: number) => void;
  /** Owners only: opens the product form. */
  onEdit?: () => void;
}

const PILL = { good: styles.pillGood, low: styles.pillLow, out: styles.pillOut };

const valueIn = (options: IOption[], name: string, value: string): IOptionValue | undefined => {
  const o = options.filter(x => x.name === name)[0];
  return o ? o.values.filter(v => v.value === value)[0] : undefined;
};

const ProductPage: React.FC<IProductPageProps> = ({ product: p, currency, inCart, onBack, onAdd, onEdit }) => {
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const [qty, setQty] = React.useState(1);
  const [picked, setPicked] = React.useState<Partial<Combo>>({});
  const { options, variants } = p;

  // The shop can reload while the page is open, and an owner may have changed the options since.
  const current: Partial<Combo> = {};
  options.forEach(o => {
    const v = picked[o.name];
    if (v && valueIn(options, o.name, v)) current[o.name] = v;
  });

  // A product with no options has its one variant from the start.
  const variant = findVariant(options, variants, current);
  const missing = options.filter(o => !current[o.name]).map(o => o.name);
  const left = variant ? stockLeft(variant.inStock) : 0;
  const mine = variant ? inCart.filter(l => l.variant === variant.label).reduce((n, l) => n + l.qty, 0) : 0;
  // What can still go in the cart, on top of what is there already.
  const room = Math.max(0, left - mine);
  const max = Math.max(1, room);
  const stock = stockLabel(p.inStock);
  const note = pickNote(options, variant);

  const noneLeft = (optionIndex: number, value: string): boolean =>
    leftFor(options, variants, current, optionIndex, value) === 0;

  // Picking a choice that has photos (a colour, say) puts its photos first.
  const pictures = galleryFor(p, current);
  const whichOption = (name: string): number => options.map(o => o.name).indexOf(name);

  // Screen readers start reading from the product, not from wherever the click was.
  React.useEffect(() => {
    if (titleRef.current) titleRef.current.focus();
  }, [p.id]);

  // Stock can drop (another order, or more in the cart) while the page is open.
  React.useEffect(() => {
    if (qty > max) setQty(max);
  }, [qty, max]);

  /* Picking the picked value again unpicks it. */
  const pick = (index: number, value: string): void => {
    const o = options[index];
    const next: Partial<Combo> = { ...current };
    if (current[o.name] === value) delete next[o.name];
    else next[o.name] = value;
    // A higher pick can leave a lower one sold out; drop it rather than sit on something that can't be bought.
    setPicked(dropSoldOut(options, variants, next));
    setQty(1);
  };

  const pictureOut = (pic: IGalleryPicture): boolean => {
    const i = pic.option ? whichOption(pic.option) : -1;
    return i >= 0 && !!pic.value && noneLeft(i, pic.value);
  };

  const pickPicture = (pic: IGalleryPicture): void => {
    const i = pic.option ? whichOption(pic.option) : -1;
    if (i >= 0 && pic.value) pick(i, pic.value);
  };

  const description = p.longDescription || p.shortDescription;

  return (
    <div>
      <div className={styles.pageTop}>
        <button type="button" className={styles.back} onClick={onBack}><BackArrow />All products</button>
        {onEdit && (
          <button type="button" className={css(styles.btn, styles.ghost, styles.small)} onClick={onEdit}>
            Edit product
          </button>
        )}
      </div>
      <div className={styles.detail}>
        <Gallery
          name={p.name}
          pictures={pictures}
          isPicked={pic => !!pic.option && current[pic.option] === pic.value}
          isOut={pictureOut}
          onPick={pickPicture}
        />

        <div className={styles.buy}>
          <div>
            <h2 className={styles.title} ref={titleRef} tabIndex={-1}>{p.name}</h2>
            {p.productCode && <div className={styles.code}>{p.productCode}</div>}
          </div>
          <div className={styles.bigPrice}>{variant ? formatMoney(variant.price, currency) : priceText(p, currency)}</div>
          <span className={css(styles.pill, PILL[stock.level])}>{stock.text}</span>

          {description && <p className={styles.lede}>{description}</p>}

          {p.details.length > 0 && (
            <ul className={styles.specs}>
              {p.details.map((line, i) => {
                const d = splitDetail(line);
                return (
                  <li key={i}>
                    {d.label && <span className={styles.specLabel}>{d.label}</span>}
                    <span>{d.value}</span>
                  </li>
                );
              })}
            </ul>
          )}

          {options.map((o, oi) => (
            <div key={o.name} className={styles.field}>
              <span className={styles.fieldLabel} aria-hidden="true">{o.name}</span>
              <div className={styles.choices} role="group" aria-label={o.name}>
                {o.values.map(v => {
                  const on = current[o.name] === v.value;
                  const out = noneLeft(oi, v.value);
                  // A pick that sold out while the page was open stays clickable, so it can be unpicked.
                  return (
                    <button
                      key={v.value} type="button" className={css(styles.choice, out && styles.choiceOut)}
                      aria-pressed={on}
                      disabled={out && !on}
                      title={out ? `${v.value} — none left` : v.value}
                      onClick={() => pick(oi, v.value)}
                    >
                      {v.value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {note && <p className={styles.pickNote} aria-live="polite">{note}</p>}

          <div className={styles.field}>
            <span className={styles.fieldLabel} aria-hidden="true">Quantity</span>
            <Stepper value={qty} min={1} max={max} label="Quantity" disabled={room === 0} onChange={setQty} />
          </div>

          <button
            type="button" className={css(styles.btn, styles.wide)} disabled={!variant || room === 0}
            onClick={() => {
              if (!variant) return;
              onAdd(variant, qty);
              setQty(1);
            }}
          >
            {addButtonText({ totalLeft: stockLeft(p.inStock), missing, left, inCart: mine })}
          </button>
          {variant && mine > 0 && room > 0 && (
            <p className={styles.inCart}>
              {variant.label === ONE_SIZE
                ? `You have ${mine} in your cart.`
                : `You have ${mine} (${variant.label}) in your cart.`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductPage;
