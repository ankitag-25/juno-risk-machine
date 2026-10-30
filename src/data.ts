import { makeScenarios, makeUsers } from "./engine/users";
export const USERS = makeUsers();
export const SCENARIOS = makeScenarios();
export const ALL = [...SCENARIOS, ...USERS];
