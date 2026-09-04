#!/usr/bin/env bash
# Stage exactly what gets published, into the directory given as $1.
#
# The deploy workflow and test/site.test.mjs both call this, so what CI tests is
# what CI ships.
set -euo pipefail

out="${1:?usage: stage-site.sh <output-directory>}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

rm -rf "$out"
mkdir -p "$out"

# The app, and the files the browser asks for by name.
cp "$here/index.html" "$here/manifest.webmanifest" "$out/"
cp -r "$here/icons" "$out/"

# Caveat is embedded in index.html as base64, so publishing the page publishes
# the font. The SIL Open Font License asks that its text travel with it.
cp -r "$here/licenses" "$out/"

# Belt and braces: the Actions deploy path never runs Jekyll, but this keeps a
# branch-based deploy honest too.
touch "$out/.nojekyll"
