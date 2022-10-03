import Logger from "@reactioncommerce/logger";
import ReactionError from "@reactioncommerce/reaction-error";
import doesDatabaseVersionMatch from "@reactioncommerce/db-version-check";
import { migrationsNamespace } from "../migrations/migrationsNamespace.js";
import { extendFulfillmentSchemas } from "./simpleSchemas.js";

const logCtx = { name: "fulfillment", file: "preStartup" };
const expectedVersion = 4;

/**
 * @summary Checks if the version of the database matches requirement
 * @param {Object} context Startup context
 * @returns {undefined}
 */
async function dbVersionCheck(context) {
  const setToExpectedIfMissing = async () => {
    const anyFulfillment = await context.collections.Fulfillment.findOne();
    const anyRestriction = await context.collections.FulfillmentRestrictions.findOne();

    return !anyFulfillment || !anyRestriction;
  };

  const ok = await doesDatabaseVersionMatch({
    // `db` is a Db instance from the `mongodb` NPM package,
    // such as what is returned when you do `client.db()`
    db: context.app.db,
    // These must match one of the namespaces and versions
    // your package exports in the `migrations` named export
    expectedVersion,
    namespace: migrationsNamespace,
    setToExpectedIfMissing
  });

  if (!ok) {
    throw new Error(`Database needs migrating. The "${migrationsNamespace}" namespace must be at version ${expectedVersion}.`);
  }
}

/**
 * @summary Called before startup to extend schemas
 * @param {Object} context Startup context
 * @returns {undefined}
 */
export default async function fulfillmentPreStartup(context) {
  await dbVersionCheck(context);
  const allFulfillmentTypesArray = context.allRegisteredFulfillmentTypes?.registeredFulfillmentTypes;

  if (!allFulfillmentTypesArray || allFulfillmentTypesArray.length === 0) {
    Logger.warn(logCtx, "No fulfillment types available");
    throw new ReactionError("not-configured", "No fulfillment types available");
  }

  extendFulfillmentSchemas(context.simpleSchemas, allFulfillmentTypesArray);
}
