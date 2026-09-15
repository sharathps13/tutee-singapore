#!/bin/bash
# Double-click this file to preview the Tutee Connect Singapore landing page locally.
# It starts a small web server in this folder and opens your browser.
# Close the Terminal window (or press Ctrl+C) to stop it.

cd "$(dirname "$0")" || exit 1

echo "======================================================"
echo "  Tutee Connect Singapore - local preview"
echo "======================================================"
echo ""

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 was not found on this Mac."
  echo ""
  echo "Install Apple's command line tools by running:"
  echo "    xcode-select --install"
  echo ""
  echo "Alternatively, just double-click index.html to open the page"
  echo "directly in your browser - it works without a server."
  echo ""
  read -n 1 -s -r -p "Press any key to close..."
  exit 1
fi

python3 serve.py "$@"

echo ""
read -n 1 -s -r -p "Server stopped. Press any key to close..."
