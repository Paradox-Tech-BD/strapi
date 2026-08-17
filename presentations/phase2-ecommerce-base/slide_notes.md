# 1 - Phase 2 at a Glance

Phase 2 successfully extended our native commerce base to handle multi-currency checkout and regional tax operations. We focused on building out robust BDT support, dynamic exemptions, and clean customer APIs while keeping our test suite and TypeScript checks completely green. And this foundation sets us up nicely for the production hardening planned in Phase 3.

# 2 - Why the Extension Was Needed

We started with a solid generic commerce core, but it lacked the regional machinery needed for real-world deployment. Moving from a single-currency assumption to explicit support for BDT at a fixed exchange rate required a complete overhaul of our tax and checkout contracts. And rather than building a separate storefront, we extended the native base plugin so all applications inherit these capabilities cleanly.

# 3 - Currency and Tax Computation Pipeline

Currency conversion is now baked directly into the tax computation pipeline rather than tacked on at the end. Every request normalizes the currency, validates it against supported options, and runs through our tax rules before anything gets persisted. Best of all, we preserved backward compatibility so legacy calls without currency context keep their expected result shape.

# 4 - Dynamic Exemption Model

Exemptions are no longer hardcoded into our jurisdiction logic, but handled as data-driven rules that evaluate at runtime. The engine checks active windows, regional constraints, and customer tags before applying the highest matching exemption percentage. Every decision gets logged directly into the order metadata for complete audit transparency.

# 5 - Checkout and Customer API Surface

We exposed a clean storefront contract covering both public checkout previews and authenticated customer preferences. Crucially, the preview endpoint shares the exact same calculation path as order persistence, eliminating any drift between what the customer sees and what actually gets stored. This keeps the storefront lightweight while centralizing all business logic inside the native plugin.

# 6 - E2E Failure Diagnosis

When our end to end test first failed, we initially suspected a React rendering defect. But the browser loaded the Strapi admin shell successfully, and the tax rules route returned a clean four-oh-four. That pointed straight to a missing server plugin route rather than a broken component. The root cause turned out to be in our generated app composition. The test app template had an empty config file and did not declare the ecommerce base plugin as a dependency. So while the admin bundle tried to load the UI, the server had no idea the plugin existed.

# 7 - E2E Fixes and Integration Chain

Fixing the missing loader was only the entry point. Once the plugin actually loaded, it exposed a cascade of real integration issues across the codebase. We had to update our dependency declarations, clean up legacy permission bootstrapping, and migrate to current Strapi 5 role service methods. We also aligned our Playwright selectors and dialog button components with the actual Design System v2 accessibility contract. That complete five step remediation chain turned our initial four-oh-four into a fully verified admin workflow where tests could create, list, and delete BDT tax rules.

# 8 - Validation Results

We treated Phase 2 as complete only after every single quality gate passed with deterministic evidence. All eighty one ecommerce base unit tests passed successfully. Both frontend and backend TypeScript checks came through clean, and the server and admin bundles built without errors. Most importantly, all three Playwright workflows for the tax rules administration passed in a regenerated Strapi test application. We synchronized everything back to main, leaving us with a verified, production grade commerce base extension.

# 9 - Phase 3 Priorities

Now we turn that new domain capability into a hardened, highly testable storefront contract. Our immediate priority for Phase 3 is stabilizing shared checkout behavior before expanding any administrative surfaces. We need rigorous coverage on checkout validation, cart to customer integration, and active currency persistence. Once those contracts are rock solid, we will layer on the protected exemption administration workflows and operational audit seams. Keeping this strict sequencing prevents drift between our storefront display and what actually gets persisted.

# 10 - Engineering Principles and Next Decision

Phase 2 succeeded because we extended native Strapi boundaries instead of building a parallel commerce platform. As we head into Phase 3, our operating model remains clear. We keep core domain logic inside the native plugin, register permissions server side first, and strictly honor Design System v2 patterns. We also preserve legacy result shapes for existing callers while layering in our new multi currency tax details. Our next step is starting immediately on checkout validation and cart integration tests. We have a fully verified Phase 2 foundation, and we are ready to build the next layer securely.
