import mockContext from "@reactioncommerce/api-utils/tests/mockContext.js";
import applyImplicitPromotions from "./applyPromotions.js";

const testTrigger = jest.fn().mockReturnValue(Promise.resolve(true));
const testAction = jest.fn();
const testEnhancer = jest.fn().mockImplementation((context, cart) => cart);

const pluginPromotion = {
  triggers: [{ key: "test", handler: testTrigger }],
  actions: [{ key: "test", handler: testAction }],
  enhancers: [testEnhancer]
};

const testPromotion = {
  _id: "test id",
  actions: [{ actionKey: "test" }],
  triggers: [{ triggerKey: "test", triggerParameters: { name: "test trigger" } }],
  stackAbility: "none"
};

beforeEach(() => {
  jest.clearAllMocks();
});

test("should save cart with implicit promotions are applied", async () => {
  const cart = {
    _id: "cartId"
  };
  mockContext.collections.Promotions = {
    find: () => ({ toArray: jest.fn().mockResolvedValueOnce([testPromotion]) })
  };
  mockContext.promotions = pluginPromotion;
  mockContext.simpleSchemas = {
    Cart: { clean: jest.fn() }
  };

  await applyImplicitPromotions(mockContext, cart);

  expect(testTrigger).toBeCalledWith(mockContext, expect.objectContaining({ _id: cart._id }), {
    promotion: testPromotion,
    triggerParameters: { name: "test trigger" }
  });
  expect(testAction).toBeCalledWith(mockContext, expect.objectContaining({ _id: cart._id }), {
    actionKey: "test",
    promotion: testPromotion
  });
  expect(testEnhancer).toBeCalledWith(mockContext, expect.objectContaining({ _id: cart._id }));

  const expectedCart = { ...cart, appliedPromotions: [testPromotion] };
  expect(cart).toEqual(expectedCart);
});

test("should update cart with implicit promotions are not applied when promotions don't contain trigger", async () => {
  const cart = {
    _id: "cartId"
  };
  mockContext.collections.Promotions = {
    find: () => ({
      toArray: jest.fn().mockResolvedValueOnce([testPromotion, { ...testPromotion, _id: "test id 2", stackAbility: "all" }])
    })
  };

  mockContext.promotions = { ...pluginPromotion, triggers: [] };
  mockContext.simpleSchemas = {
    Cart: { clean: jest.fn() }
  };

  await applyImplicitPromotions(mockContext, cart);

  expect(testTrigger).not.toHaveBeenCalled();
  expect(testAction).not.toHaveBeenCalled();

  const expectedCart = { ...cart, appliedPromotions: [] };
  expect(cart).toEqual(expectedCart);
});