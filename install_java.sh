#!/bin/bash
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" openjdk-17-jdk
