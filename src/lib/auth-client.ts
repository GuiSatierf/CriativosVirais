"use client";
import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

// Admin actions run through /api/admin (server checks and audit log), so only two-factor is needed here.
export const authClient = createAuthClient({ plugins: [twoFactorClient()] });
