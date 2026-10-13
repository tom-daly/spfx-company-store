import * as React from 'react';
import { Checkbox, DefaultButton, TextField } from '@fluentui/react';
import styles from './StockGrid.module.scss';
import type { IOption } from '../../store/types';
import type { Combo } from '../../store/variants';
import { IFormLine, IFormRow, IStockTable, readCount, totalStock } from '../../store/productForm';
import { countText } from '../../store/orderText';

/** What changed in one combination's boxes. */
export type CellChange = Partial<Pick<IFormLine, 'inStock' | 'price'>>;

type OnCell = (combo: Combo, change: CellChange) => void;

interface ICellProps {
  row: IFormRow;
  /** The product's name, when there may be more than one grid on the page. */
  of?: string;
  onChange: OnCell;
}

interface IPriceCellProps extends ICellProps {
  /** What an empty price box means, like "$22.00". */
  usual: string;
}

const boxName = (what: string, row: IFormRow, of?: string): string => `${what}, ${of ? `${of}, ` : ''}${row.label}`;

const StockCell: React.FC<ICellProps> = ({ row, of, onChange }) => (
  <input
    className={styles.cell} inputMode="numeric" value={row.inStock} aria-label={boxName('In stock', row, of)}
    onChange={e => onChange(row.combo, { inStock: e.target.value })}
  />
);

const PriceCell: React.FC<IPriceCellProps> = ({ row, usual, of, onChange }) => (
  <input
    className={styles.cell} inputMode="decimal" value={row.price} placeholder={usual}
    aria-label={boxName('Price (if different)', row, of)}
    onChange={e => onChange(row.combo, { price: e.target.value })}
  />
);

interface ISheetProps {
  /** The option down the side. Missing for a product with one option, which gets a single row. */
  down?: IOption;
  /** The option across the top. */
  across: IOption;
  rows: IFormRow[];
  usual: string;
  of?: string;
  onChange: OnCell;
  prices: boolean;
}

/*
 * A stockroom sheet: one option down the side, the other across the top, a
 * stock box in each cell (and a price box under it, when asked for).
 */
const Sheet: React.FC<ISheetProps> = ({ down, across, rows, usual, of, onChange, prices }) => {
  const rowFor = (a: string | undefined, b: string): IFormRow | undefined =>
    rows.filter(r => r.combo[across.name] === b && (!down || r.combo[down.name] === a))[0];
  const cells = (a: string | undefined, box: (row: IFormRow) => JSX.Element): JSX.Element[] =>
    across.values.map(b => {
      const row = rowFor(a, b.value);
      return <td key={b.value}>{row && box(row)}</td>;
    });
  const stock = (row: IFormRow): JSX.Element => <StockCell row={row} of={of} onChange={onChange} />;
  const price = (row: IFormRow): JSX.Element => <PriceCell row={row} usual={usual} of={of} onChange={onChange} />;
  const downs: (string | undefined)[] = down ? down.values.map(v => v.value) : [undefined];

  return (
    <div className={styles.tableScroll}>
      <table className={styles.matrix}>
        <thead>
          <tr>
            <th scope="col">{down ? `${down.name} / ${across.name}` : across.name}</th>
            {prices && down && <td />}
            {across.values.map(b => <th scope="col" key={b.value} className={styles.across}>{b.value}</th>)}
          </tr>
        </thead>
        <tbody>
          {downs.map(a => {
            const key = a === undefined ? 'one' : a;
            const name = a !== undefined && <th scope="row" rowSpan={prices ? 2 : 1} className={styles.down}>{a}</th>;
            return prices ? (
              <React.Fragment key={key}>
                <tr className={styles.groupStart}>
                  {name}
                  <th scope="row" className={styles.what}>In stock</th>
                  {cells(a, stock)}
                </tr>
                <tr>
                  <th scope="row" className={styles.what}>Price</th>
                  {cells(a, price)}
                </tr>
              </React.Fragment>
            ) : (
              <tr key={key} className={styles.plainRow}>
                {name || <th scope="row" className={styles.what}>In stock</th>}
                {cells(a, stock)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

interface IStockSheetsProps {
  table: IStockTable;
  usual: string;
  of?: string;
  onChange: OnCell;
  /** Show a price box with each stock box. */
  prices: boolean;
}

/*
 * One option: a single row. Two: a grid. Three: a grid for each choice of the
 * third, stacked, so the sheet grows in readable pieces rather than one long list.
 */
const StockSheets: React.FC<IStockSheetsProps> = ({ table, usual, of, onChange, prices }) => {
  const [first, second, third] = table.options;
  const down = second ? first : undefined;
  const across = second || first;
  const grid = (rows: IFormRow[]): JSX.Element => (
    <Sheet down={down} across={across} rows={rows} usual={usual} of={of} onChange={onChange} prices={prices} />
  );
  if (!third) return grid(table.rows);
  return (
    <div className={styles.sheets}>
      {third.values.map(v => {
        const rows = table.rows.filter(r => r.combo[third.name] === v.value);
        const total = totalStock({ ...table, rows });
        return (
          <div key={v.value} className={styles.sheet}>
            <h4 className={styles.sheetTitle}>
              {third.name}: {v.value} <span className={styles.sheetTotal}>{total} in stock</span>
            </h4>
            {grid(rows)}
          </div>
        );
      })}
    </div>
  );
};

export interface IStockEditorProps {
  /** The combinations as they stand, with what is typed in each. */
  table: IStockTable;
  /** What an empty price box means, like "$22.00". */
  usual: string;
  /** The price boxes are showing: ticked, or some combination has a price typed. */
  prices: boolean;
  onPrices: (on: boolean) => void;
  onChange: OnCell;
  /** The same number in every box. */
  onFill: (count: number) => void;
  /** The product's name, when there may be more than one of these on the page. */
  of?: string;
}

/*
 * The stock and prices of every combination, as the product form and the
 * Products page both show them: one box for a product that comes one way only;
 * otherwise the sheets, with a tick for prices of their own, a quick fill, and
 * the total.
 */
const StockEditor: React.FC<IStockEditorProps> = ({ table, usual, prices, onPrices, onChange, onFill, of }) => {
  // "Same number in every box", as typed.
  const [fillWith, setFillWith] = React.useState('');
  const count = table.rows.length;

  if (!table.options.length) {
    if (!count) return null;
    const row = table.rows[0];
    return (
      <TextField
        className={styles.narrow} label="In stock" inputMode="numeric" value={row.inStock}
        ariaLabel={of ? `In stock, ${of}` : undefined}
        onChange={(_, text) => onChange(row.combo, { inStock: text || '' })}
      />
    );
  }
  if (!count) return null;

  const fill = readCount(fillWith);
  return (
    <div className={styles.stock}>
      <p className={styles.hint}>
        {`${countText(count, 'combination')}. `}Set how many of each you have.
      </p>
      <div className={styles.tools}>
        <Checkbox
          label="Some combinations cost more or less than the usual price"
          ariaLabel={of ? `Some combinations of ${of} cost more or less than the usual price` : undefined}
          checked={prices} onChange={(_, on) => onPrices(!!on)}
        />
        {count > 1 && (
          <div className={styles.fill}>
            <TextField
              className={styles.fillBox} label="Same number in every box" inputMode="numeric"
              ariaLabel={of ? `Same number in every box for ${of}` : undefined}
              value={fillWith} onChange={(_, text) => setFillWith(text || '')}
            />
            <DefaultButton
              text="Fill" disabled={fill === undefined}
              onClick={() => { if (fill !== undefined) onFill(fill); }}
            />
          </div>
        )}
      </div>
      <StockSheets table={table} usual={usual} of={of} onChange={onChange} prices={prices} />
      <p className={styles.total}>
        <strong>Total in stock: {totalStock(table)}.</strong>{' '}
        A combination with nothing left stays on the page but can&apos;t be ordered.
      </p>
    </div>
  );
};

export default StockEditor;
