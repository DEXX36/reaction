import mockContext from "@reactioncommerce/api-utils/tests/mockContext.js";
import getCombinationOfPromotions from "./getCombinationOfPromotions.js";

test("should return the best promotions", async () => {
  const cart = {
    _id: "cartId",
    shopId: "shopId",
    items: [
      {
        _id: "itemId",
        productId: "productId",
        variantId: "variantId",
        quantity: 1,
        price: {
          amount: 10,
          currencyCode: "USD"
        },
        subtotal: {
          amount: 10,
          currencyCode: "USD"
        }
      }
    ]
  };
  const promotions = [
    {
      _id: "promotionId1",
      triggerType: "implicit",
      discount: 2,
      stackability: {
        key: "all"
      }
    },
    {
      _id: "promotionId2",
      triggerType: "implicit",
      discount: 3,
      stackability: {
        key: "none"
      }
    },
    {
      _id: "promotionId3",
      triggerType: "explicit",
      discount: 4,
      stackability: {
        key: "all"
      }
    }
  ];

  const canBeApplied = jest.fn().mockImplementation((_, __, { promotion }) => {
    if (promotion._id === "promotionId1") return { qualifies: true };
    if (promotion._id === "promotionId2") return { qualifies: false, reason: "does not qualify" };
    return { qualifies: true };
  });

  mockContext.promotions = {
    enhancers: [],
    qualifiers: [],
    utils: {
      canBeApplied
    }
  };

  const result = await getCombinationOfPromotions(mockContext, cart, promotions);
  expect(result).toEqual([
    [promotions[1]],
    [promotions[2], promotions[0]]
  ]);
});
