#!/bin/bash
VERSION="0.0.2"
npm install
npm run build
cd dist
7zz a breach_in_time-${VERSION}.zip index.html assets/*
rm -rf ../../spillz.github.io/7drl-2024/
mkdir ../../spillz.github.io/7drl-2024/
cp -r * ../../spillz.github.io/7drl-2024/
cd ..
