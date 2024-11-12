source .env

API_KEY=$GRAFANA_USER_ID:$GRAFANA_API_KEY
URL=$GRAFANA_URL
total=0

while true;
    do
        curl -X POST -H "Authorization: Bearer $API_KEY" -H "Content-Type: text/plain" "$URL" -d "request,method=post,source=example_metrics total=$total";
        total=$((total+(100 + RANDOM % 901)));
        echo $total;
    sleep 1;
done;