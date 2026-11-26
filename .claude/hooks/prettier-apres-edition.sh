#!/usr/bin/env bash
fichier=$(jq -r '.tool_input.file_path // empty')
case "$fichier" in
  *.ts | *.tsx) ;;
  *) exit 0 ;;
esac
[ -f "$fichier" ] || exit 0

# exit 2 : PostToolUse renvoie stderr à Claude, qui corrige la syntaxe tout de suite
if ! sortie=$(npx --no-install prettier --write --log-level warn "$fichier" 2>&1); then
  printf 'prettier a échoué sur %s, corriger la syntaxe :\n%s\n' "$fichier" "$sortie" >&2
  exit 2
fi
