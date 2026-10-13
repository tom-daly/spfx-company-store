import { lockOutOrder, hasLevel, RoleType, CAN_CHANGE_LIST, CAN_ADD } from './permissions';
import { MANAGERS_GROUP } from './schema';
import { EVERYONE, LIMITED_MANAGERS } from './__fixtures__/states';

describe('lockOutOrder', () => {
  const assignments = [
    { principalId: 3, loginName: 'Site Owners' },     // the person running setup is in this one
    { principalId: 4, loginName: 'Site Members' },
    { principalId: 12, loginName: 'i:0#.f|membership|me@example.com' },
    { principalId: 5, loginName: 'Site Visitors' },
    { principalId: 9, loginName: EVERYONE.toUpperCase() }
  ];

  it('removes everyone else first, then my groups, then me — and keeps staff', () => {
    expect(lockOutOrder(assignments, EVERYONE, 12, [3])).toEqual([4, 5, 3, 12]);
  });

  it('has nothing to do when only staff are left', () => {
    expect(lockOutOrder([{ principalId: 9, loginName: EVERYONE }], EVERYONE, 12, [3])).toEqual([]);
  });

  it('takes the store managers off too, if the site\'s permissions brought them along', () => {
    const copied = [...assignments, LIMITED_MANAGERS];
    expect(lockOutOrder(copied, EVERYONE, 12, [3])).toEqual([4, 5, 20, 3, 12]);
  });
});

describe('hasLevel', () => {
  const access = [
    { principalId: 20, loginName: 'Renamed by hand', roles: [RoleType.editor] },
    { principalId: 21, loginName: MANAGERS_GROUP, roles: [RoleType.guest] }
  ];

  it('finds a group by its ID, not its name', () => {
    expect(hasLevel(access, 20, CAN_CHANGE_LIST)).toBe(true);
    expect(hasLevel(access, 21, CAN_CHANGE_LIST)).toBe(false);
  });

  it('doesn\'t count the Limited Access SharePoint hands out on its own', () => {
    expect(hasLevel(access, 21, CAN_ADD)).toBe(false);
  });

  it('counts Edit as enough to add photos, but not Contribute as enough to run a list', () => {
    expect(hasLevel(access, 20, CAN_ADD)).toBe(true);
    expect(hasLevel([{ principalId: 20, loginName: 'x', roles: [RoleType.contributor] }], 20, CAN_CHANGE_LIST))
      .toBe(false);
  });
});
