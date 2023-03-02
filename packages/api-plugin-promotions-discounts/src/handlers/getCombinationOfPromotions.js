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

    const startPos = implicitPromotions.indexOf(combination[combination.length - 1]) + 1 || 0;
    // eslint-disable-next-line no-plusplus
    for (let pos = startPos; pos < implicitPromotions.length; pos++) {
      const promotion = implicitPromotions[pos];
      const { qualifies } = await utils.canBeApplied(context, cart, { appliedPromotions: combination, promotion });
      if (qualifies) {
        const tempArray = [...combination, promotion];
        const subsets = combinations.filter((result) => _.differenceBy(result, tempArray, "id").length === 0);
        combinations = combinations.filter((result) => !subsets.includes(result));
        stack.push(tempArray);
        continue;
      }

      if (!combinations.some((comb) => comb.length === 1 && comb[0].id === promotion.id)) {
        combinations.push([promotion]);
      }
    }
  }

  return combinations;
}
