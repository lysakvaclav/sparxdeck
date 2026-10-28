import type { ProtocolModel } from "@/lib/protocol";
import type { BlockCondition } from "./schema";
import { isVariable } from "./variables";

// When a block of a protocol template shows (part 22, stage C). No condition:
// always. A condition the protocol can't answer (an unknown variable) hides
// the block rather than guess.

type Facts = Pick<ProtocolModel, "counts" | "devices" | "variables">;

export function conditionHolds(condition: BlockCondition | undefined, protocol: Facts): boolean {
  if (!condition) return true;
  switch (condition.when) {
    case "hasDefects":
      return protocol.counts.defects > 0;
    case "noDefects":
      return protocol.counts.defects === 0;
    case "failed":
      return protocol.counts.failed > 0;
    case "deviceType": {
      const wanted = condition.type.trim().toLocaleLowerCase();
      return protocol.devices.some((device) => device.type.trim().toLocaleLowerCase() === wanted);
    }
    case "notEmpty":
      return isVariable(condition.variable) && protocol.variables[condition.variable].trim() !== "";
  }
}
