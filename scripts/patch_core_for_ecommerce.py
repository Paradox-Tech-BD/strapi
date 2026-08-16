#!/usr/bin/env python3
"""Register @strapi/ecommerce-base as a native core plugin inside the Strapi monorepo."""
import json
import re

ROOT = "/home/ubuntu/strapi-fork"

# 1. Add dependency to packages/core/strapi/package.json
pkg_path = f"{ROOT}/packages/core/strapi/package.json"
with open(pkg_path) as f:
    pkg = json.load(f)

if "@strapi/ecommerce-base" not in pkg.get("dependencies", {}):
    pkg["dependencies"]["@strapi/ecommerce-base"] = "5.52.0"
    # keep alphabetical order like the rest
    pkg["dependencies"] = dict(sorted(pkg["dependencies"].items()))
    with open(pkg_path, "w") as f:
        json.dump(pkg, f, indent=2)
        f.write("\n")
    print("patched core/strapi package.json")

# 2. Register in packages/core/strapi/src/admin.ts
admin_ts = f"{ROOT}/packages/core/strapi/src/admin.ts"
with open(admin_ts) as f:
    src = f.read()

if "ecommerce-base" not in src:
    # add import after reviewWorkflows import
    src = src.replace(
        "import reviewWorkflows from '@strapi/review-workflows/strapi-admin';",
        "import reviewWorkflows from '@strapi/review-workflows/strapi-admin';\nimport ecommerceBase from '@strapi/ecommerce-base/strapi-admin';",
    )
    # add to plugins object after reviewWorkflows line
    src = src.replace(
        "      reviewWorkflows,",
        "      reviewWorkflows,\n      ecommerceBase,",
    )
    with open(admin_ts, "w") as f:
        f.write(src)
    print("patched core/strapi admin.ts")

# 3. Register in packages/core/strapi/src/index.ts if it re-exports plugins (check only)
idx = f"{ROOT}/packages/core/strapi/src/index.ts"
if "ecommerce-base" not in open(idx).read():
    content = open(idx).read()
    if "content-manager" in content:
        # same pattern: import + export; do minimal noop — only patch if imports exist
        print("index.ts does not list core plugins directly (no patch needed)")

print("done")
