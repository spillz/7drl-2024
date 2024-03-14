#!/bin/bash
npm install
npm run build
cd dist
7zz a breach_in_time_0.0.1.zip index.html assets/*
rm -rf ../../spillz.github.io/7drl-2024/
mkdir ../../spillz.github.io/7drl-2024/
cp -r breach_in_time_0.0.3.zip ../../spillz.github.io/7drl-2024/
cd ..