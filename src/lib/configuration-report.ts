import { missingOptionalConfiguration } from "./env";

/** Startup warning for each optional provider that is off, naming variables, never their values. */
export function logMissingConfiguration(processName: "app" | "worker") {
  for (const { feature, variables } of missingOptionalConfiguration())
    console.warn(`[config] ${processName}: ${feature} off until ${variables.join(" and ")} are set.`);
}
