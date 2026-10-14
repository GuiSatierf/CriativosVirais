import type { Connector } from "./types";
// TODO: implement only after the user confirms an official public API and access contract.
export const vkmetrics: Connector = {
  async sync() {
    return {
      records: [],
      warning: "VK Metrics aguarda confirmação da API pública.",
    };
  },
};
