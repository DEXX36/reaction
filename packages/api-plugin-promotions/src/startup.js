import Logger from "@reactioncommerce/logger";
import { createRequire } from "module";
import { Action, Trigger } from "./simpleSchemas.js";
import noop from "./actions/noop.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

const { name, version } = pkg;
const logCtx = {
  name,
  version,
  file: "startup.js",
};

/**
 * @summary apply all schema extensions to the Promotions schema
 * @param {Object} context - The application context
 * @returns {undefined} undefined
 */
function extendSchemas(context) {
  const {
    promotions: { schemaExtensions },
    simpleSchemas: { Promotions },
  } = context;
  schemaExtensions.forEach((extension) => {
    Promotions.extend(extension);
  });
}

/**
 * @summary Perform various scaffolding tasks on startup
 * @param {Object} context - The application context
 * @returns {Promise<void>} undefined
 */
export default async function startup(context) {
  promotionContext.registerAction("noop", noop);

  extendSchemas(context);
  const { actions: additionalActions, triggers: additionalTriggers } = context.promotions;
  Action.extend({
    actionKey: {
      allowedValues: [...Action.getAllowedValuesForKey("actionKey"), ...additionalActions],
    },
  });

  Trigger.extend({
    triggerKey: {
      allowedValues: [...Trigger.getAllowedValuesForKey("triggerKey"), ...additionalTriggers],
    },
  });

  context.appEvents.on("afterCartCreate", async (args) => {
    const { cart, emittedBy } = args;
    if (emittedBy !== "promotions") {
      await applyPromotionsToCart(context, cart);
    }
  });

  context.appEvents.on("afterCartUpdate", async (args) => {
    const { cart, emittedBy } = args;
    if (emittedBy !== "promotions") {
      await applyPromotionsToCart(context, cart);
    }
  });
}

async function getPromotions(context) {
  const {
    collections: { Promotions },
  } = context;
  const promotions = await Promotions.find({
    enabled: true,
    // "startDate": { $lt: now },
    // "endDate": { $gt: now }
  }).toArray();
  Logger.info({ ...logCtx, applicablePromotions: promotions.length }, "Fetched applicable promotions");
  return promotions;
}

async function applyPromotionsToCart(context, cart) {
  const promotions = await getPromotions(context);

  for (let promotion of promotions) {
    const { triggers, actions } = promotion;
    const trigger = triggers[0];
    const { triggerKey, triggerParameters } = trigger;
    const triggerFn = context.promotionContext.triggers[triggerKey];
    if (triggerFn) {
      const shouldApply = await triggerFn(context, cart, triggerParameters);
      if (shouldApply) {
        for (let action of actions) {
          const { actionKey, actionParameters } = action;
          const actionFn = context.promotionContext.actions[actionKey];
          if (actionFn) {
            await actionFn(context, cart, actionParameters);
          }
        }
      }
    }
  }
}
