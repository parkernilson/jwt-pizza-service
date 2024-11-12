host=localhost:3000

while true
 do curl -s $host/api/order/menu;
    echo "got menu!";
  sleep 3;
 done;