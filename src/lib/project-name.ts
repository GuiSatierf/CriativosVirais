import { z } from "zod";

/** Shared by the API and the sidebar dialogs, so both accept the same names. */
export const projectNameMaxLength = 80;
export const projectNameSchema = z.string().trim().min(1).max(projectNameMaxLength);
