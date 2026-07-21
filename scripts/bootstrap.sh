#!/usr/bin/env bash
# ZodHub Pulse bootstrap — run once on your Mac after pulling new frontend code.
# Installs npm deps and pulls the shadcn/ui components ZodHub Pulse uses.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Installing npm dependencies..."
npm install

echo "==> Adding shadcn/ui components..."
npx shadcn@latest add --yes --overwrite \
  sidebar \
  button \
  card \
  chart \
  badge \
  separator \
  select \
  switch \
  toggle-group \
  tabs \
  label \
  input \
  progress \
  skeleton \
  scroll-area \
  tooltip \
  dropdown-menu \
  sonner \
  alert \
  empty

echo "==> Generating tweakcn themes..."
node scripts/build-themes.mjs

echo "==> Downloading theme fonts (local woff2)..."
node scripts/build-fonts.mjs

echo "==> Done. Start the app with:  npm run tauri dev"
