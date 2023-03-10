/* eslint-disable no-await-in-loop */
import _ from "lodash";

/**
 * @summary get the combination of promotions
 * @param {Object} context - The application context
 * @param {Object} cart - The cart to apply the promotion to
 * @param {Array<Object>} promotions - The promotions to apply
 * @returns {Promise<Object>} - The best promotions
 */
export default async function getCombinationOfPromotions(context, cart, promotions) {
  const { promotions: { utils } } = context;

  const explicitPromotions = promotions.filter((promotion) => promotion.triggerType === "explicit");
  const implicitPromotions = promotions.filter((promotion) => promotion.triggerType === "implicit");

  const stack = [explicitPromotions];
  let combinations = [];

  while (stack.length > 0) {
    const combination = stack.pop();
    combinations.push(combination);

    const nextPosition = implicitPromotions.indexOf(_.last(combination)) + 1 || 0;
    // eslint-disable-next-line no-plusplus
    for (let position = nextPosition; position < implicitPromotions.length; position++) {
      const promotion = implicitPromotions[position];
      const { qualifies } = await utils.canBeApplied(context, cart, { appliedPromotions: combination, promotion });
      if (qualifies) {
        const newCombination = [...combination, promotion];
        stack.push(newCombination);
        continue;
      }

      if (!combinations.some((comb) => comb.length === 1 && comb[0]._id === promotion._id)) {
        combinations.push([promotion]);
      }
    }
  }

  // remove combination if is a subset of another combinations
  combinations = combinations.filter((combination) => !combinations.some((otherCombination) => {
    if (combination === otherCombination) return false;
    return _.differenceBy(combination, otherCombination, "_id").length === 0;
  }));

  return combinations;
}
