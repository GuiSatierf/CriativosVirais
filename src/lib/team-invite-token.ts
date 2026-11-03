import { z } from "zod";

export const teamInviteTokenHeader = "x-team-invite-token";
export const teamInviteTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
