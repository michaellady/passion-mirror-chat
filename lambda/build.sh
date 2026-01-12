#!/bin/bash
set -e

# Clean
rm -rf dist bootstrap.zip

# Install dependencies
npm install

# Build with esbuild
npm run build

# Create bootstrap file for Lambda custom runtime
cat > dist/bootstrap << 'EOF'
#!/bin/sh
set -e
exec node --experimental-modules index.mjs
EOF
chmod +x dist/bootstrap

# Package
npm run package

echo "Built: lambda/bootstrap.zip"
