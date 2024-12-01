#!/bin/bash

source .env

account_id=$LOKI_LOGS_ACCOUNT_ID
api_key=$LOKI_LOGS_API_KEY
log_url=$LOKI_LOGS_URL



for i in {1..100}; do
  (( RANDOM % 2 )) && level="warn" || level="info"

  curl -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $account_id:$api_key" \
    -d '{"streams": [{"stream": {"component":"jwt-pizza-service", "level": "'"$level"'", "type":"http-req"},"values": [["'"$(($(date +%s)*1000000000))"'","{\"name\":\"hacker\", \"email\":\"d@jwt.com\", \"password\":\"****\"}",{"user_id": "44","traceID": "9bc86924d069e9f8ccf09192763f1120"}]]}]}' \
    $log_url

  sleep 3
done