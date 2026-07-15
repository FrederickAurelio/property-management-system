module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "chore",
        "revert",
      ],
    ],
    "scope-enum": [
      2,
      "always",
      ["api", "pms", "web", "packages", "repo", "deps"],
    ],
    "scope-empty": [2, "never"],
    "subject-case": [2, "never", ["pascal-case", "upper-case"]],
    "header-max-length": [2, "always", 300],
    "body-max-line-length": [2, "always", 300],
    "footer-max-line-length": [2, "always", 300],
  },
};
