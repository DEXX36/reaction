import { createRequire } from "module";
import { promotions, registerPluginHandlerForPromotions } from "./registration.js";
import mutations from "./mutations/index.js";
import preStartupPromotions from "./preStartup.js";
import { Promotion } from "./simpleSchemas.js";
import actions from "./actions/index.js";
import qualifiers from "./qualifiers/index.js";
import promotionTypes from "./promotionTypes/index.js";
import schemas from "./schemas/index.js";
import queries from "./queries/index.js";
import resolvers from "./resolvers/index.js";
import applyPromotions from "./handlers/applyPromotions.js";
import startupPromotions from "./startup.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

/**
 * @summary Import and call this function to add this plugin to your API.
 * @param {Object} app The ReactionAPI instance
 * @returns {undefined}
 */
export default async function register(app) {
  await app.registerPlugin({
    label: pkg.label,
    name: pkg.name,
    version: pkg.version,
    graphQL: {
      schemas,
      resolvers
    },
    collections: {
      Promotions: {
        name: "Promotions",
        indexes: [
          [{ shopId: 1, type: 1, enabled: 1, startDate: 1, endDate: 1 }, { name: "shopId__type__enabled__startDate_endDate" }],
          [{ shopId: 1, referenceId: 1 }, { unique: true }],
          [
            { "shopId": 1, "type": 1, "enabled": 1, "triggers.triggerKey": 1, "triggers.triggerParameters.couponCode": 1, "startDate": 1 },
            { name: "shopId__type__enabled__triggerKey__couponCode__startDate" }
          ]
        ]
      }
    },
    simpleSchemas: {
      Promotion
    },
    functionsByType: {
      registerPluginHandler: [registerPluginHandlerForPromotions],
      preStartup: [preStartupPromotions],
      startup: [startupPromotions]
    },
    contextAdditions: {
      promotions
    },
    cart: {
      transforms: [
        {
          name: "applyPromotionsToCart",
          fn: applyPromotions,
          priority: 99
        }
      ]
    },
    promotions: {
      actions,
      qualifiers,
      promotionTypes
    },
    sequenceConfigs: [
      {
        entity: "Promotions"
      }
    ],
    mutations,
    queries
  });
}