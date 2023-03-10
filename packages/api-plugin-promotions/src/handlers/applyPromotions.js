/* eslint-disable no-await-in-loop */
import { createRequire } from "module";
import Logger from "@reactioncommerce/logger";
import ReactionError from "@reactioncommerce/reaction-error";
import _ from "lodash";
import enhanceCart from "../utils/enhanceCart.js";
import isPromotionExpired from "../utils/isPromotionExpired.js";
import createCartMessage from "../utils/createCartMessage.js";
import canAddToCartMessages from "../utils/canAddCartMessage.js";
import triggerHandler from "./triggerHandler.js";
import applyCombinationPromotions from "./applyCombinationPromotions.js";
import getHighestCombination from "./getHighestCombination.js";

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
 * @param {Date} currentTime - The current time
 * @returns {Promise<Array<Object>>} - An array of promotions
 */
async function getImplicitPromotions(context, shopId, currentTime) {
  const { collections: { Promotions } } = context;

  const selector = {
    shopId,
    triggerType: "implicit",
    startDate: { $lte: currentTime },
    state: {
      $in: ["created", "active"]
    }
  };

  const promotions = await Promotions.find(selector).toArray();

  Logger.info({ ...logCtx, applicablePromotions: promotions.length }, "Fetched applicable promotions");
  return promotions;
}

/**
 * @summary get all explicit promotions by Ids
 * @param {Object} context - The application context
 * @param {String} shopId - The shop ID
 * @param {Array<string>} promotionIds - The promotion IDs
 * @returns {Promise<Array<Object>>} - An array of promotions
 */
async function getExplicitPromotionsByIds(context, shopId, promotionIds) {
  const now = new Date();
  const { collections: { Promotions } } = context;
  const promotions = await Promotions.find({
    _id: { $in: promotionIds },
    shopId,
    enabled: true,
    triggerType: "explicit",
    startDate: { $lt: now }
  }).toArray();
  return promotions;
}

/**
 * @summary get custom current time from header
 * @param {Object} context - The application context
 * @returns {String|undefined} - The custom current time
 */
function getCustomCurrentTime(context) {
  return context.session?.req?.headers["x-custom-current-promotion-time"];
}

/**
 * @summary get the current time
 * @param {Object} context - The application context
 * @param {String} shopId - The shop ID
 * @returns {Promise<Date>} - The current time
 */
export async function getCurrentTime(context, shopId) {
  const now = new Date();
  const customCurrentTime = getCustomCurrentTime(context);

  if (!customCurrentTime) return now;
  if (!(await context.userHasPermission("reaction:legacy:promotions", "preview", { shopId }))) return now;

  const currentTime = new Date(customCurrentTime);
  if (currentTime.toString() === "Invalid Date") {
    Logger.warn("Invalid custom current time provided. Returning system time.");
    return now;
  }
  return currentTime;
}

/**
 * @summary apply promotions to a cart
 * @param {Object} context - The application context
 * @param {Object} cart - The cart to apply promotions to
 * @returns {Promise<Object>} - mutated cart
 */
export default async function applyPromotions(context, cart) {
  const currentTime = await getCurrentTime(context, cart.shopId);
  const promotions = await getImplicitPromotions(context, cart.shopId, currentTime);
  const { promotions: pluginPromotions, simpleSchemas: { Cart } } = context;

  const appliedExplicitPromotionsIds = _.map(_.filter(cart.appliedPromotions || [], ["triggerType", "explicit"]), "_id");
  const explicitPromotions = await getExplicitPromotionsByIds(context, cart.shopId, appliedExplicitPromotionsIds);

  const unqualifiedPromotions = promotions.concat(_.map(explicitPromotions, (promotion) => {
    const existsPromotion = _.find(cart.appliedPromotions || [], { _id: promotion._id });
    if (existsPromotion) promotion.relatedCoupon = existsPromotion.relatedCoupon || undefined;
    if (typeof existsPromotion?.newlyAdded !== "undefined") promotion.newlyAdded = existsPromotion.newlyAdded;
    return promotion;
  }));

  const newlyAddedPromotionId = _.find(unqualifiedPromotions, "newlyAdded")?._id;

  for (const { cleanup } of pluginPromotions.actions) {
    cleanup && await cleanup(context, cart);
  }

  const applicablePromotions = [];
  const enhancedCart = enhanceCart(context, pluginPromotions.enhancers, cart);
  if (enhancedCart.appliedPromotions) {
    enhancedCart.appliedPromotions.length = 0;
  }

  for (const promotion of unqualifiedPromotions) {
    if (!promotion.enabled) {
      if (canAddToCartMessages(cart, promotion)) {
        enhancedCart.messages.push(createCartMessage({
          title: "The promotion no longer available",
          subject: "promotion",
          severity: "warning",
          metaFields: {
            promotionId: promotion._id
          }
        }));
      }
      continue;
    }

    if (isPromotionExpired(promotion)) {
      Logger.info({ ...logCtx, promotionId: promotion._id }, "Promotion is expired, skipping");
      if (canAddToCartMessages(cart, promotion)) {
        enhancedCart.messages.push(createCartMessage({
          title: "The promotion has expired",
          subject: "promotion",
          severity: "warning",
          metaFields: {
            promotionId: promotion._id
          }
        }));
      }
      continue;
    }

    const isPassesTrigger = await triggerHandler(context, enhancedCart, promotion);
    if (!isPassesTrigger) {
      Logger.info({ ...logCtx, promotionId: promotion._id }, "The promotion is not eligible, skipping");
      if (canAddToCartMessages(cart, promotion)) {
        enhancedCart.messages.push(createCartMessage({
          title: "The promotion is not eligible",
          subject: "promotion",
          severity: "warning",
          metaFields: {
            promotionId: promotion._id
          }
        }));
      }
      continue;
    }

    applicablePromotions.push(promotion);
  }

  let highestPromotions = applicablePromotions;
  if (pluginPromotions.getCombinationOfPromotions) {
    const filteredPromotions = _.filter(
      applicablePromotions,
      (promotion) => !_.some(pluginPromotions.combinationFilters, (filter) => filter.handler(context, promotion))
    );
    const exceptedPromotions = _.differenceBy(applicablePromotions, filteredPromotions, "_id");
    const combinationPromotions = await pluginPromotions.getCombinationOfPromotions(context, enhancedCart, filteredPromotions);
    highestPromotions = await getHighestCombination(context, enhancedCart, combinationPromotions);
    highestPromotions = highestPromotions.concat(exceptedPromotions);

    const differencePromotions = _.differenceBy(applicablePromotions, highestPromotions, "_id");
    for (const diffPromotion of differencePromotions) {
      if (_.findIndex(cart.appliedPromotions, { _id: diffPromotion._id }) !== -1) {
        const message = "The promotion has been replaced by another promotion with the highest discount";
        Logger.info({ ...logCtx, promotionId: diffPromotion._id }, message);
        enhancedCart.messages.push(createCartMessage({
          title: message,
          message,
          subject: "promotion",
          severity: "info",
          metaFields: {
            promotionId: diffPromotion._id
          }
        }));
      }
    }
  }

  await applyCombinationPromotions(context, enhancedCart, { promotions: highestPromotions });

  enhancedCart.appliedPromotions = _.map(enhancedCart.appliedPromotions, (promotion) => _.omit(promotion, "newlyAdded"));

  // If a explicit promotion was just applied, throw an error so that the client can display the message
  if (newlyAddedPromotionId) {
    const message = _.find(enhancedCart.messages, ({ metaFields }) => metaFields.promotionId === newlyAddedPromotionId);
    if (message) throw new ReactionError("invalid-params", message.message);
  }

  // Remove messages that are no longer relevant
  enhancedCart.messages = _.filter(enhancedCart.messages, (message) => {
    if (message.subject !== "promotion") return true;
    return _.find(enhancedCart.appliedPromotions, { _id: message.metaFields.promotionId, triggerType: "implicit" }) === undefined;
  });

  Cart.clean(enhancedCart, { mutate: true });
  Object.assign(cart, enhancedCart);

  Logger.info({ ...logCtx, appliedPromotions: enhancedCart.appliedPromotions.length }, "Applied promotions successfully");
  return cart;
}
