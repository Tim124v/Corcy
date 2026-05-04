export type PlanName = 'FREE' | 'PRO' | 'TEAM';

export type PlanLimits = {
  maxInvitesPerMonth: number; // -1 = безлимит
  maxRooms: number; // -1 = безлимит
  maxRoomMembers: number;
  maxContacts: number; // -1 = безлимит
  unlimitedHistory: boolean;
  e2eRooms: boolean;
};

export const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  FREE: {
    maxInvitesPerMonth: 3,
    maxRooms: 2,
    maxRoomMembers: 10,
    maxContacts: 10,
    unlimitedHistory: false,
    e2eRooms: false,
  },
  PRO: {
    maxInvitesPerMonth: -1,
    maxRooms: 10,
    maxRoomMembers: 50,
    maxContacts: -1,
    unlimitedHistory: true,
    e2eRooms: true,
  },
  TEAM: {
    maxInvitesPerMonth: -1,
    maxRooms: -1,
    maxRoomMembers: 200,
    maxContacts: -1,
    unlimitedHistory: true,
    e2eRooms: true,
  },
};

export function getLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan as PlanName] ?? PLAN_LIMITS.FREE;
}

export function isUnlimited(value: number): boolean {
  return value === -1;
}

