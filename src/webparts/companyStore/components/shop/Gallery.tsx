import * as React from 'react';
import { Icon, css } from '@fluentui/react';
import styles from './Shop.module.scss';
import { IGalleryPicture, startAt } from '../../store/gallery';
import Photo from './Photo';

export interface IGalleryProps {
  /** The product's name, for the big picture's alt text. */
  name: string;
  /** In order, from galleryFor. */
  pictures: IGalleryPicture[];
  /** Whether the choice a picture belongs to is picked already. */
  isPicked: (picture: IGalleryPicture) => boolean;
  /** Whether the choice a picture belongs to has none left, given what is picked above it. */
  isOut: (picture: IGalleryPicture) => boolean;
  /** Picks the choice a picture belongs to, as its button would. */
  onPick: (picture: IGalleryPicture) => void;
}

/* The big picture, previous and next on it, and a row of thumbnails under it. */
const Gallery: React.FC<IGalleryProps> = ({ name, pictures, isPicked, isOut, onPick }) => {
  const thumbsRef = React.useRef<HTMLDivElement>(null);
  const count = pictures.length;
  const list = pictures.map(pic => pic.url).join('\n');
  // Which picture is big, remembered with the list it was chosen from. When the
  // list changes (a colour picked or unpicked), it opens on the picked colour's
  // first photo — or the cover — and the old place is forgotten.
  const opening = startAt(pictures, isPicked);
  const [shown, setShown] = React.useState({ list, index: opening });
  if (shown.list !== list) setShown({ list, index: opening });
  const index = shown.list === list && shown.index < count ? shown.index : opening;
  const big = pictures[index];

  // Going past either end comes round to the other.
  const show = (i: number): void => setShown({ list, index: (i + count) % count });

  /* A choice's thumbnail picks that choice, the same as its button, and the
     gallery then opens on that choice's photos. Once picked, it just shows. */
  const choose = (i: number): void => {
    const pic = pictures[i];
    if (pic.value && !isPicked(pic)) onPick(pic);
    else show(i);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const to = (index + (e.key === 'ArrowRight' ? 1 : -1) + count) % count;
    show(to);
    // Moving along the thumbnails takes the focus along too, so it stays on the one outlined.
    const thumbs = thumbsRef.current;
    if (thumbs && thumbs.contains(e.target as Node)) {
      const next = thumbs.querySelectorAll('button')[to];
      if (next && !next.disabled) next.focus();
    }
  };

  const several = count > 1;

  return (
    <div className={styles.gallery} onKeyDown={several ? onKeyDown : undefined}>
      {/* Clicking the picture gives it focus, so the arrow keys work straight after. */}
      <div className={styles.stage} tabIndex={several ? -1 : undefined}>
        <Photo
          url={big ? big.url : undefined}
          alt={big && big.value ? `${name}, ${big.value}` : name}
          className={styles.mainPhoto}
        />
        {several && (
          <>
            <button
              type="button" className={css(styles.flip, styles.flipPrev)}
              aria-label="Previous photo" title="Previous photo" onClick={() => show(index - 1)}
            >
              <Icon iconName="ChevronLeft" aria-hidden="true" />
            </button>
            <button
              type="button" className={css(styles.flip, styles.flipNext)}
              aria-label="Next photo" title="Next photo" onClick={() => show(index + 1)}
            >
              <Icon iconName="ChevronRight" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {several && (
        <>
          <p className={styles.srOnly} aria-live="polite">
            {`Photo ${index + 1} of ${count}${big && big.value ? `: ${big.value}` : ''}`}
          </p>
          <div className={styles.thumbs} ref={thumbsRef} role="group" aria-label="Photos">
            {pictures.map((pic, i) => {
              const on = !!pic.value && isPicked(pic);
              const out = !!pic.value && isOut(pic);
              const position = `${i + 1} of ${count}`;
              /* The same photo never shows twice, so its address is a steady key: focus stays
                 on a choice's thumbnail when picking it moves it to the front. Like its choice
                 button, a pick that sold out while the page was open stays clickable. */
              return (
                <button
                  key={pic.url} type="button"
                  className={css(styles.thumb, out && styles.thumbOut)}
                  aria-current={i === index}
                  aria-label={!pic.value
                    ? `Photo ${position}`
                    : out ? `${pic.value}, none left` : `${pic.value}, photo ${position}`}
                  disabled={out && !on}
                  title={out ? `${pic.value} — none left` : pic.value}
                  onClick={() => choose(i)}
                >
                  <Photo url={pic.url} alt="" className={styles.thumbPhoto} small />
                  {pic.value && <span className={styles.thumbName}>{pic.value}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default Gallery;
