import type { DuckLook } from './ducks';

export type Level = 0 | 1 | 2 | 3;
export type Status = 'present' | 'absent';
export type Commitment = 'confirmed' | 'risk' | 'unavailable';
export type Preset = 'business' | 'education' | 'government' | 'custom';
export type Titles = [string, string, string, string];

export interface WorkspaceConfig {
  name: string;
  preset: Preset;
  groupLabel: string;
  unitLabel: string;
  personLabel: string;
  titles: Titles;
  shiftStart: string;
  shiftEnd: string;
  targetPct: number;
  days: number[];
}

export interface Person {
  id: string;
  name: string;
  level: Level;
  parentId: string | null;
  position: string;
  /** Name of the team/unit this person leads (level ≥ 1). */
  branch: string;
  photo?: string;
  /** Secret shared with this person's device at join time; verifies their check-in passes. */
  passKey?: string;
  joined: 'owner' | 'manual' | 'invite';
  createdAt: number;
}

export interface AttendanceRecord { s: Status; at: number; by: string; via?: 'swipe' | 'pass' | 'self' | 'correction' }
export interface CommitmentRecord { c: Commitment; at: number; note?: string }

export interface Announcement {
  id: string;
  authorId: string;
  /** 'all' or the id of the person whose branch receives the post. */
  scopeId: string;
  text: string;
  priority: 'normal' | 'important';
  at: number;
}

export type AuditKind = 'mark' | 'undo' | 'correct' | 'join' | 'add' | 'remove' | 'move';
export interface AuditEntry {
  at: number;
  date: string;
  actor: string;
  subject: string;
  kind: AuditKind;
  from: Status | null;
  to: Status | null;
  reason?: string;
}

export interface Invite {
  id: string;
  token: string;
  parentId: string;
  level: Level;
  createdBy: string;
  createdAt: number;
  expiresAt: number;
  maxUses: number;
  uses: number;
  revoked?: boolean;
}

export interface TriviaQuestion {
  id: string;
  category: string;
  question: string;
  options: [string, string, string, string];
  answer: 0 | 1 | 2 | 3;
}

export type Policy = Record<string, number>;

/** Present when this device joined a team by scanning an invite; the full roster lives on the inviter's device. */
export interface JoinLink {
  inviteId: string;
  token: string;
  joinedAt: number;
}

export interface Workspace {
  id: string;
  createdAt: number;
  config: WorkspaceConfig;
  ownerId: string;
  meId: string;
  people: Person[];
  policy: Policy;
  attendance: Record<string, Record<string, AttendanceRecord>>;
  commitments: Record<string, Record<string, CommitmentRecord>>;
  announcements: Announcement[];
  acked: Record<string, Record<string, number>>;
  audit: AuditEntry[];
  invites: Invite[];
  trivia: TriviaQuestion[];
  gameEntries: string;
  /** Duck race looks keyed by participant name (lower-case). */
  ducks: Record<string, DuckLook>;
  link?: JoinLink;
}

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  accent: 'green' | 'teal' | 'blue' | 'violet' | 'rose' | 'amber';
  density: 'compact' | 'comfortable';
  textSize: 'default' | 'large';
  motion: 'system' | 'full' | 'reduced';
  undoSeconds: 5 | 10 | 30;
  swipeSensitivity: 'gentle' | 'balanced' | 'quick';
  triviaTimer: 0 | 15 | 30;
  sound: boolean;
  haptics: boolean;
  confirmAbsent: boolean;
}

export interface AppData {
  v: 3;
  activeId: string | null;
  workspaces: Record<string, Workspace>;
  settings: Settings;
  triviaBest: number;
}

export interface Org {
  people: Person[];
  byId: Map<string, Person>;
  children: Map<string, Person[]>;
  roots: Person[];
}
