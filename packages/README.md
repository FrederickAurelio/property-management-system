# packages/

Shared libraries live here (e.g. `@cabin/shared-types`).

Import into apps via workspace protocol once a package is added:

```json
"@cabin/shared-types": "workspace:*"
```

Keep empty until two apps need the same code.
