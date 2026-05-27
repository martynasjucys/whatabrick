/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as alerts from "../alerts.js";
import type * as alertsActions from "../alertsActions.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as http from "../http.js";
import type * as items from "../items.js";
import type * as itemsActions from "../itemsActions.js";
import type * as lib_anthropic from "../lib/anthropic.js";
import type * as lib_bricklink from "../lib/bricklink.js";
import type * as lib_digest from "../lib/digest.js";
import type * as lib_rebrickable from "../lib/rebrickable.js";
import type * as lib_scoring from "../lib/scoring.js";
import type * as lib_verdict from "../lib/verdict.js";
import type * as marketSnapshots from "../marketSnapshots.js";
import type * as marketSnapshotsActions from "../marketSnapshotsActions.js";
import type * as radars from "../radars.js";
import type * as radarsActions from "../radarsActions.js";
import type * as signalScores from "../signalScores.js";
import type * as signalScoresActions from "../signalScoresActions.js";
import type * as users from "../users.js";
import type * as weeklyDigest from "../weeklyDigest.js";
import type * as weeklyDigestActions from "../weeklyDigestActions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  alerts: typeof alerts;
  alertsActions: typeof alertsActions;
  crons: typeof crons;
  dashboard: typeof dashboard;
  http: typeof http;
  items: typeof items;
  itemsActions: typeof itemsActions;
  "lib/anthropic": typeof lib_anthropic;
  "lib/bricklink": typeof lib_bricklink;
  "lib/digest": typeof lib_digest;
  "lib/rebrickable": typeof lib_rebrickable;
  "lib/scoring": typeof lib_scoring;
  "lib/verdict": typeof lib_verdict;
  marketSnapshots: typeof marketSnapshots;
  marketSnapshotsActions: typeof marketSnapshotsActions;
  radars: typeof radars;
  radarsActions: typeof radarsActions;
  signalScores: typeof signalScores;
  signalScoresActions: typeof signalScoresActions;
  users: typeof users;
  weeklyDigest: typeof weeklyDigest;
  weeklyDigestActions: typeof weeklyDigestActions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
