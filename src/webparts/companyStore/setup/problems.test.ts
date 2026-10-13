import { findProblems, allListsExist } from './problems';
import {
  EVERYONE, LIMITED_MANAGERS, MANAGERS, OWNERS, STAFF, healthy, empty, change, lastVersion, oldStatusColumn
} from './__fixtures__/states';

describe('findProblems', () => {
  it('finds nothing wrong with a site exactly as setup leaves it', () => {
    expect(findProblems(healthy(), EVERYONE)).toEqual([]);
  });

  it('says every list and the Store managers group are still to make on an empty site, and that the owner can do it', () => {
    const problems = findProblems(empty(), EVERYONE);
    expect(problems.map(p => p.list)).toEqual(['settings', 'products', 'stock', 'orders', 'addresses', undefined]);
    expect(problems[5].text).toBe('The Store managers group hasn\'t been made yet.');
    expect(problems.every(p => p.fixable)).toBe(true);
    expect(allListsExist(empty())).toBe(false);
  });

  it('names a missing column by the name people see', () => {
    const state = change(healthy(), 'orders', { fields: ['Title', 'OrderItems'] });
    const [first] = findProblems(state, EVERYONE);
    expect(first.text).toContain('Store orders is missing 12 columns');
    expect(first.text).toContain('Ship to');
    expect(first.fixable).toBe(true);
  });

  it('catches site owners still able to open the address list', () => {
    const state = change(healthy(), 'addresses', { canManage: true, access: [OWNERS, STAFF] });
    expect(findProblems(state, EVERYONE).map(p => p.text))
      .toEqual(['Site owners can still open Store addresses.']);
  });

  it('hands anything wrong with the locked address list to IT', () => {
    const state = change(healthy(), 'addresses', { fields: ['Title'] });
    const problems = findProblems(state, EVERYONE);
    expect(problems).toHaveLength(1);
    expect(problems[0].fixable).toBe(false);
  });

  it('catches staff being able to see each other\'s orders', () => {
    const state = change(healthy(), 'orders', { readSecurity: 1 });
    expect(findProblems(state, EVERYONE).map(p => p.text))
      .toEqual(["Staff could see each other's rows in Store orders."]);
  });

  it('catches a list that still follows the site, so staff cannot add to it', () => {
    const state = change(healthy(), 'stock', { uniquePermissions: false });
    expect(findProblems(state, EVERYONE).map(p => p.text)).toEqual(["Staff can't add to Store stock yet."]);
  });

  it('catches lists that should be hidden or kept out of search', () => {
    const state = change(healthy(), 'addresses', { hidden: false, noCrawl: false, versioning: true });
    expect(findProblems(state, EVERYONE).map(p => p.text)).toEqual([
      'Store addresses still shows in the site contents.',
      'Store addresses still shows up in search.',
      'Store addresses keeps old copies of every change.'
    ]);
  });

  it('notices a Status column that lacks the newer statuses', () => {
    expect(findProblems(oldStatusColumn(), EVERYONE).map(p => p.text))
      .toEqual(['The Status column in Store orders is missing 3 choices: Confirmed, Ready for pick-up, Picked up.']);
  });

  it('lists what a site the last version set up needs, all of it for the owner to fix', () => {
    const problems = findProblems(lastVersion(), EVERYONE);
    expect(problems.map(p => p.text)).toEqual([
      'Store orders is missing 3 columns: Ready by, Tracking, Picked up on.',
      'The Status column in Store orders is missing 1 choice: Confirmed.',
      'The Store managers group hasn\'t been made yet.'
    ]);
    expect(problems.every(p => p.fixable)).toBe(true);
  });

  it('catches store managers who can\'t change a list, counting Limited Access as no way in', () => {
    const state = change(change(healthy(), 'products', { access: [OWNERS, LIMITED_MANAGERS] }), 'stock',
      { access: [OWNERS, STAFF] });
    expect(findProblems(state, EVERYONE).map(p => p.text)).toEqual([
      'Store managers can\'t change Store products yet.',
      'Store managers can\'t change Store stock yet.'
    ]);
  });

  it('finds the group by its ID, so renaming it by hand changes nothing', () => {
    const renamed = { ...MANAGERS, loginName: 'Shop team' };
    expect(findProblems(change(healthy(), 'orders', { access: [OWNERS, STAFF, renamed] }), EVERYONE)).toEqual([]);
  });

  it('catches store managers who can\'t add product photos', () => {
    expect(findProblems({ ...healthy(), photos: { exists: false } }, EVERYONE).map(p => p.text))
      .toEqual(['Store managers can\'t add product photos yet.']);
    const readOnly = { exists: true, uniquePermissions: false, access: [OWNERS, STAFF] };
    expect(findProblems({ ...healthy(), photos: readOnly }, EVERYONE).map(p => p.text))
      .toEqual(['Store managers can\'t add product photos yet.']);
  });

  it('never asks for store managers on the address list', () => {
    const halfDone = change(healthy(), 'addresses', { canManage: true, access: [STAFF] });
    expect(findProblems(halfDone, EVERYONE)).toEqual([]);
  });
});
