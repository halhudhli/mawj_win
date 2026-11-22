// Every interface text, by area. A key may appear in one area only.
import type { Entry } from "../index";
import { account } from "./account";
import { addons } from "./addons";
import { app } from "./app";
import { backend } from "./backend";
import { browse } from "./browse";
import { library } from "./library";
import { player } from "./player";
import { settings } from "./settings";
import { tv } from "./tv";

export const STRINGS = { ...app, ...browse, ...library, ...tv, ...player, ...settings, ...account, ...addons, ...backend } satisfies Record<string, Entry>;
export type StringKey = keyof typeof STRINGS;
