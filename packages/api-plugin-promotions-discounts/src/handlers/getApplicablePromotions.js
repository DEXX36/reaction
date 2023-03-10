import _ from "lodash";
import getCombinationOfPromotions from "./getCombinationOfPromotions.js";
import getHighestCombination from "./getHighestCombination.js";

/**
 * @summary get all applicable promotions
 * @param {*} context - The application context
 * @param {*} cart - The cart to apply the promotion to
 * @param {*} promotions - The promotions to apply
 * @returns {Promise<Array<Object>>} - An array of promotions
 */
export default async function getApplicablePromotions(context, cart, promotions) {
  const { promotions: { combinationFilters } } = context;

  const filteredPromotions = _.filter(promotions, (promotion) => !_.some(combinationFilters, (filter) => filter.handler(context, promotion)));
  const exceptedPromotions = _.differenceBy(promotions, filteredPromotions, "_id");
  const combinationPromotions = await getCombinationOfPromotions(context, cart, filteredPromotions);
  const highestPromotions = await getHighestCombination(context, cart, combinationPromotions);
  const applicablePromotions = highestPromotions.concat(exceptedPromotions);

  return applicablePromotions;
}
