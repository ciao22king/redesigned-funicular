#!/usr/bin/env bash
# Publish the converted MLC weights to the `models` branch of the repository.
#
# WebLLM loads every artefact from a Hugging Face-style layout: it appends
# `resolve/main/` to the model URL (its `cleanModelUrl`). GitHub's raw host
# serves that path with `Access-Control-Allow-Origin: *` and no size limit, so
# the branch holds `resolve/main/<files>` and the app points at
# `.../models/resolve/main`.
#
# A release asset would be the obvious home, but it sends no CORS header, so the
# browser refuses it. This branch is the workaround.
#
# Usage: GITHUB_TOKEN=... publish_weights.sh <dir-with-mlc-files>
set -euo pipefail

SRC="${1:?usage: publish_weights.sh <dir-with-mlc-files>}"
OWNER_REPO="ciao22king/redesigned-funicular"
BRANCH="models"
TOKEN="${GITHUB_TOKEN:?GITHUB_TOKEN is not set}"
WORK=/tmp/models-repo

rm -rf "$WORK"
mkdir -p "$WORK/resolve/main"
cp "$SRC"/* "$WORK/resolve/main/"

cd "$WORK"
git init -q
git config user.name openhands
git config user.email openhands@all-hands.dev
git add -A
git commit -q -m "skillforge-skiller-0.5B: MLC q4f16_1 weights

Fine-tuned Qwen2.5-0.5B-Instruct, converted to MLC q4f16_1 by
skiller-training/mlc_export.py (byte-exact against MLC's quantizer).
Published on this branch so WebLLM can load it over HTTPS with CORS."
git remote add origin "https://x-access-token:${TOKEN}@github.com/${OWNER_REPO}.git"
git push -f origin "HEAD:${BRANCH}"

echo "pushed $(ls "$SRC" | wc -l) files to ${OWNER_REPO}@${BRANCH}"
