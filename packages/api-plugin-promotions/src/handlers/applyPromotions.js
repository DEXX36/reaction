import { createRequire } from "module";
import Logger from "@reactioncommerce/logger";
import _ from "lodash";
import canBeApplied from "../utils/canBeApplied.js";
import enhanceCart from "../utils/enhanceCart.js";
import isPromotionExpired from "../utils/isPromotionExpired.js";

const require = createRequire(import.meta.url);
const pkg = require("../../package.json");

const { name, version } = pkg;
const logCtx = {
  name,
  version,
  file: "applyImplicitPromotions.js"
};

/**
 * @summary get all implicit promotions
 * @param {Object} context - The application context
 * @param {String} shopId - The shop ID
 * @returns {Promise<Array<Object>>} - An array of promotions
 */
async function getImplicitPromotions(context, shopId) {
  const now = new Date();
  const { collections: { Promotions } } = context;
  const promotions = await Promotions.find({
    shopId,
    enabled: true,
    triggerType: "implicit",
    startDate: { $lt: now },
    endDate: { $gt: now }
  }).toArray();
  Logger.info({ ...logCtx, applicablePromotions: promotions.length }, "Fetched applicable promotions");
  return promotions;
}

/**
 * @summary apply promotions to a cart
 * @param {Object} context - The application context
 * @param {Object} cart - The cart to apply promotions to
 * @returns {Promise<void>} - undefined
 */
export default async function applyPromotions(context, cart) {
  const promotions = await getImplicitPromotions(context, cart.shopId);
  const { promotions: pluginPromotions, simpleSchemas: { Cart } } = context;

  const triggerHandleByKey = _.keyBy(pluginPromotions.triggers, "key");
  const actionHandleByKey = _.keyBy(pluginPromotions.actions, "key");

  const appliedPromotions = [];
  const appliedExplicitPromotions = _.filter(cart.appliedPromotions || [], ["triggerType", "explicit"]);

  const unqualifiedPromotions = promotions.concat(appliedExplicitPromotions);

  for (const { cleanup } of pluginPromotions.actions) {
    // eslint-disable-next-line no-await-in-loop
    cleanup && await cleanup(context, cart);
  }

  let enhancedCart = enhanceCart(context, pluginPromotions.enhancers, cart);
  for (const promotion of unqualifiedPromotions) {
    if (isPromotionExpired(promotion)) {
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const { qualifies } = await canBeApplied(context, appliedPromotions, promotion);
    if (!qualifies) {
      continue;
    }

    for (const trigger of promotion.triggers) {
      const { triggerKey, triggerParameters } = trigger;
      const triggerFn = triggerHandleByKey[triggerKey];
      if (!triggerFn) continue;

      // eslint-disable-next-line no-await-in-loop
      const shouldApply = await triggerFn.handler(context, enhancedCart, { promotion, triggerParameters });
      if (!shouldApply) continue;

      // eslint-disable-next-line no-await-in-loop
      for (const action of promotion.actions) {
        const actionFn = actionHandleByKey[action.actionKey];
        if (!actionFn) continue;

        // eslint-disable-next-line no-await-in-loop
        await actionFn.handler(context, enhancedCart, { promotion, ...action });
        enhancedCart = enhanceCart(context, pluginPromotions.enhancers, enhancedCart);
      }
      appliedPromotions.push(promotion);
      break;
    }
  }

  enhancedCart.appliedPromotions = appliedPromotions;
  Cart.clean(enhancedCart, { mutate: true });
  Object.assign(cart, enhancedCart);

  Logger.info({ ...logCtx, appliedPromotions: appliedPromotions.length }, "Applied promotions successfully");
}