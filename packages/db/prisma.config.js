"use strict";
require("dotenv/config");
const config_1 = require("prisma/config");
const env = globalThis.process?.env;
module.exports = (0, config_1.defineConfig)({
    schema: "prisma/schema.prisma",
    migrations: {
        path: "prisma/migrations",
    },
    datasource: {
        url: env?.DATABASE_URL,
    },
});
