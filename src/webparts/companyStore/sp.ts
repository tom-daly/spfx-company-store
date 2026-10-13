import type { WebPartContext } from '@microsoft/sp-webpart-base';
import { spfi, SPFI, SPFx } from '@pnp/sp';
import '@pnp/sp/webs';
import '@pnp/sp/lists';
import '@pnp/sp/fields';
import '@pnp/sp/views';
import '@pnp/sp/security';
import '@pnp/sp/site-users/web';
import '@pnp/sp/site-groups';
import '@pnp/sp/items';
import '@pnp/sp/files';
import '@pnp/sp/folders';
import '@pnp/sp/profiles';

export type { SPFI };

/* PnPjs, signed in as whoever is looking at the page. */
export const createSP = (context: WebPartContext): SPFI => spfi().using(SPFx(context));
