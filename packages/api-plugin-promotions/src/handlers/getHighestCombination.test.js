import mockContext from "@reactioncommerce/api-utils/tests/mockContext.js";
import enhanceCart from "../utils/enhanceCart.js";
import getHighestCombination from "./getHighestCombination.js";
import actionHandler from "./actionHandler.js";

jest.mock("../utils/enhanceCart.js", () => jest.fn().mockName("enhanceCart"));
jest.mock("./actionHandler.js", () => jest.fn().mockName("actionHandler"));
jest.mock("../utils/enhanceCart.js", () => jest.fn().mockName("enhanceCart"));

test("should return the highest combination of promotions", async () => {
  const cart = {
    _id: "cartId",
    items: [
      {
        _id: "itemId",
        subtotal: {
          discount: 0
        }
      },
      {
        _id: "itemId2",
        subtotal: {
          discount: 0
        }
      }
    ]
  };

  const combinations = [
    [
      { _id: "promo1", discount: 10 },
      { _id: "promo2", discount: 2 }
    ],
    [
      { _id: "promo3", discount: 3 },
      { _id: "promo4", discount: 5 }
    ]
  ];

  enhanceCart.mockImplementation((_, __, _cart) => _cart);
  actionHandler.mockImplementation((context, _cart, promo) => {
    _cart.items.forEach((item) => {
      item.subtotal.discount += promo.discount;
    });
    return { affected: true };
  });

  mockContext.promotions = {
    enhancers: []
  };

  const result = await getHighestCombination(mockContext, cart, combinations);
  const highestPromotions = combinations[0];
  expect(result).toEqual(highestPromotions);
});
