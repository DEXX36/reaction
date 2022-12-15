import { createRequire } from "module";
import Logger from "@reactioncommerce/logger";


const require = createRequire(import.meta.url);

const pkg = require("../../package.json");

const { name, version } = pkg;
const logCtx = {
  name,
  version,
  file: "handlePromotionChangedState.js"
};

/**
 * @summary get all the carts
 * @param {Object} context - The application context
 * @return {Promise<Object>} - A cursor of existing carts
 */
async function getCarts(context) {
  const { collections: { Cart } } = context;
  const cartsCursor = await Cart.find({}, { cartId: 1 });
  return cartsCursor;
}

/**
 * @summary when a promotion becomes active, create multiple jobs the existing carts
 * @param {Object} context - The application context
 * @return {Promise<Object>} The total number of carts processed
 */
export default async function handlePromotionChangedState(context) {
  Logger.info(logCtx, "Reprocessing all existing carts because promotion has changed state");
  const { bullQueue } = context;
  const cartsCursor = await getCarts(context);
  const carts = [];
  let totalCarts = 0;
  cartsCursor.forEach((cart) => {
    carts.push(cart._id); // we don't push the whole cart because it can't be completely serialized
    if (carts.length >= 500) {
      bullQueue.addJob(context, "checkExistingCarts", carts);
      totalCarts += carts.length;
      carts.length = 0; // empty this array
    }
    // process remainder when batch < 500
    if (carts.length) {
      bullQueue.addJob(context, "checkExistingCarts", carts);
      totalCarts += carts.length;
    }
  });
  Logger.info({ totalCarts, ...logCtx }, "Completed processing existing carts for Promotions");
  return { totalCarts };
}