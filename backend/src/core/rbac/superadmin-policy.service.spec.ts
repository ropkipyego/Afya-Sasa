import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { RequestContext } from '../../common/request-context';
import { Permission, Role, User, UserRole } from '../core.entities';
import { SuperadminPolicyService } from './superadmin-policy.service';

const SUPERADMIN_ROLE_ID = 'role-superadmin';
const ADMIN_ROLE_ID = 'role-administrator';
const SUPERADMIN_USER_ID = 'user-super';
const ADMIN_USER_ID = 'user-admin';

function actor(roles: string[]): RequestContext {
  return { user: { sub: 'actor-1', email: 'a@test', roles, permissions: [] } } as RequestContext;
}

describe('SuperadminPolicyService', () => {
  let service: SuperadminPolicyService;

  const rolesRepo = {
    findBy: jest.fn(),
    findOne: jest.fn(),
  };
  const userRolesRepo = {
    createQueryBuilder: jest.fn(),
  };
  const usersRepo = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const permissionsRepo = {
    findBy: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuperadminPolicyService,
        { provide: getRepositoryToken(Role), useValue: rolesRepo },
        { provide: getRepositoryToken(UserRole), useValue: userRolesRepo },
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: getRepositoryToken(Permission), useValue: permissionsRepo },
      ],
    }).compile();

    service = module.get(SuperadminPolicyService);
  });

  function mockUserHasRole(hasSuperadmin: boolean) {
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(hasSuperadmin ? 1 : 0),
    };
    userRolesRepo.createQueryBuilder.mockReturnValue(qb);
    return qb;
  }

  function mockCountActiveSuperadmins(count: number, excludeUserId?: string) {
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(count),
    };
    usersRepo.createQueryBuilder.mockReturnValue(qb);
    return qb;
  }

  it('allows superadmin to assign superadmin role', async () => {
    rolesRepo.findBy.mockResolvedValue([
      { id: SUPERADMIN_ROLE_ID, name: 'superadmin' },
    ]);
    usersRepo.findOne.mockResolvedValue({ id: SUPERADMIN_USER_ID, active: true });
    mockUserHasRole(true);

    await expect(
      service.assertCanAssignRoles(
        actor(['superadmin']),
        SUPERADMIN_USER_ID,
        [SUPERADMIN_ROLE_ID],
      ),
    ).resolves.toBeUndefined();
  });

  it('blocks administrator from assigning superadmin role', async () => {
    rolesRepo.findBy.mockResolvedValue([
      { id: SUPERADMIN_ROLE_ID, name: 'superadmin' },
    ]);
    mockUserHasRole(false);

    await expect(
      service.assertCanAssignRoles(
        actor(['administrator']),
        ADMIN_USER_ID,
        [SUPERADMIN_ROLE_ID],
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('blocks administrator from editing superadmin user roles', async () => {
    rolesRepo.findBy.mockResolvedValue([
      { id: ADMIN_ROLE_ID, name: 'administrator' },
    ]);
    mockUserHasRole(true);

    await expect(
      service.assertCanAssignRoles(
        actor(['administrator']),
        SUPERADMIN_USER_ID,
        [ADMIN_ROLE_ID],
      ),
    ).rejects.toThrow(/Only a superadmin can change roles/);
  });

  it('blocks removing the last active superadmin role', async () => {
    rolesRepo.findBy.mockResolvedValue([{ id: ADMIN_ROLE_ID, name: 'administrator' }]);
    rolesRepo.findOne.mockResolvedValue({ id: SUPERADMIN_ROLE_ID, name: 'superadmin' });
    usersRepo.findOne.mockResolvedValue({ id: SUPERADMIN_USER_ID, active: true });
    mockUserHasRole(true);
    mockCountActiveSuperadmins(0, SUPERADMIN_USER_ID);

    await expect(
      service.assertCanAssignRoles(
        actor(['superadmin']),
        SUPERADMIN_USER_ID,
        [ADMIN_ROLE_ID],
      ),
    ).rejects.toThrow(/last active superadmin/);
  });

  it('blocks deactivating the last active superadmin', async () => {
    mockUserHasRole(true);
    mockCountActiveSuperadmins(0, SUPERADMIN_USER_ID);

    await expect(
      service.assertCanChangeUserActive(
        actor(['superadmin']),
        SUPERADMIN_USER_ID,
        false,
      ),
    ).rejects.toThrow(/last active superadmin/);
  });

  it('blocks administrator from deactivating superadmin account', async () => {
    mockUserHasRole(true);

    await expect(
      service.assertCanChangeUserActive(
        actor(['administrator']),
        SUPERADMIN_USER_ID,
        false,
      ),
    ).rejects.toThrow(/Only a superadmin can activate or deactivate/);
  });

  it('rejects assigning an empty role list', async () => {
    await expect(
      service.assertCanAssignRoles(actor(['superadmin']), ADMIN_USER_ID, []),
    ).rejects.toThrow(BadRequestException);
  });

  it('blocks deactivating the current account', async () => {
    mockUserHasRole(false);
    const request = actor(['administrator']);
    request.user!.sub = ADMIN_USER_ID;

    await expect(
      service.assertCanChangeUserActive(request, ADMIN_USER_ID, false),
    ).rejects.toThrow(/cannot deactivate your own account/);
  });

  it('blocks administrator from unlocking a superadmin account', async () => {
    mockUserHasRole(true);

    await expect(
      service.assertCanUnlockUser(actor(['administrator']), SUPERADMIN_USER_ID),
    ).rejects.toThrow(/Only a superadmin can unlock/);
  });

  it('blocks non-superadmin from editing administrator role permissions', async () => {
    rolesRepo.findOne.mockResolvedValue({
      id: ADMIN_ROLE_ID,
      name: 'administrator',
    });

    await expect(
      service.assertCanUpdateRolePermissions(
        actor(['administrator']),
        ADMIN_ROLE_ID,
        [],
      ),
    ).rejects.toThrow(/Only a superadmin can modify permissions/);
  });

  it('requires core permissions on administrator role even for superadmin', async () => {
    rolesRepo.findOne.mockResolvedValue({
      id: ADMIN_ROLE_ID,
      name: 'administrator',
    });
    permissionsRepo.findBy.mockResolvedValue([
      { id: 'p1', permissionKey: 'patients:read' },
    ]);

    await expect(
      service.assertCanUpdateRolePermissions(
        actor(['superadmin']),
        ADMIN_ROLE_ID,
        ['p1'],
      ),
    ).rejects.toThrow(/must retain users:manage/);
  });

  it('filters superadmin from assignable roles for hospital administrators', () => {
    const roles = [
      { name: 'superadmin', label: 'Super Admin' },
      { name: 'administrator', label: 'Hospital Administrator' },
      { name: 'doctor', label: 'Doctor' },
    ];

    const filtered = service.filterAssignableRoles(actor(['administrator']), roles);
    expect(filtered.map((r) => r.name)).toEqual(['administrator', 'doctor']);
  });

  it('throws when role ids are invalid', async () => {
    rolesRepo.findBy.mockResolvedValue([]);

    await expect(
      service.assertCanAssignRoles(actor(['superadmin']), ADMIN_USER_ID, ['missing']),
    ).rejects.toThrow(NotFoundException);
  });
});
