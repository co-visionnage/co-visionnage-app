import { randomInt } from 'node:crypto';

const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_CODE_LENGTH = 6;

// A predictable PRNG here would let someone who observes one invite code
// (they're returned to every family member, see getHomePageData) recover
// enough state to guess codes issued around the same time -- randomInt is
// cryptographically secure, Math.random() is not.
export function generateInviteCode(): string {
  let result = '';
  for (let index = 0; index < INVITE_CODE_LENGTH; index++) {
    result += INVITE_CODE_CHARS.charAt(randomInt(INVITE_CODE_CHARS.length));
  }
  return `BRTL-${result}`;
}
