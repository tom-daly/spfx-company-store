import type { SPFI } from '../sp';
import type { ISiteInfo } from '../setup/problems';
import type { GetGraph } from '../store/orderEmail';

export interface ICompanyStoreProps {
  sp: SPFI;
  site: ISiteInfo;
  getGraph: GetGraph;
}
