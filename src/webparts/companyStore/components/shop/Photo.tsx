import * as React from 'react';
import { css } from '@fluentui/react';
import styles from './Shop.module.scss';
import { PHOTO } from '../../strings/shop';

export interface IPhotoProps {
  url?: string;
  /** What the photo shows. Empty when the product name is right next to it anyway. */
  alt: string;
  className: string;
  /** Too small to say "No photo yet": just the soft box. */
  small?: boolean;
}

/* A product photo, or a soft "No photo yet" box when there isn't one or it won't load.
   Spans rather than divs, because cards are buttons and buttons can only hold spans. */
const Photo: React.FC<IPhotoProps> = ({ url, alt, className, small }) => {
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => { setFailed(false); }, [url]);

  if (!url || failed) {
    return (
      <span
        className={css(className, styles.noPhoto)}
        role={alt ? 'img' : undefined}
        aria-label={alt ? PHOTO.noPhotoOf(alt) : undefined}
        aria-hidden={alt ? undefined : true}
      >
        {small ? '' : PHOTO.noPhoto}
      </span>
    );
  }
  return <img className={className} src={url} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
};

export default Photo;
