# <mmkolpakov_changes_dz_2>
#!/bin/bash

TARGET_HOST="balancer"
SSH_CMD="ssh -o StrictHostKeyChecking=no $TARGET_HOST"

echo "=== 1. CHECKING PROMETHEUS TARGETS ==="
$SSH_CMD "curl -s http://localhost:9090/api/v1/targets" | \
grep -oP '"job":"(.*?)".*?"health":"(.*?)"' | sort | uniq -c

echo -e "\n=== 2. CHECKING POSTGRES EXPORTER (pg_up) ==="
$SSH_CMD "curl -s 'http://localhost:9090/api/v1/query?query=pg_up'" | \
grep -oP '"value":\[.*?"(.*?)"\]'

echo -e "\n=== 3. CHECKING BLACKBOX API (probe_success) ==="
$SSH_CMD "curl -s 'http://localhost:9090/api/v1/query?query=probe_success'" | \
grep -oP '"value":\[.*?"(.*?)"\]'

echo -e "\n=== 4. CHECKING GRAFANA PORT ==="
$SSH_CMD "sudo netstat -tulpn | grep 3000"
# </mmkolpakov_changes_dz_2>
