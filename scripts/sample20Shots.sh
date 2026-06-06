#!/bin/bash
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
DEVICE=2F420E38-B692-4A60-AD2C-FFED8777B01E
mkdir -p /tmp/shots20
rm -f /tmp/shots20/*.png

# Read sample list
ids=($(python3 -c "import json; [print(x['id']) for x in json.load(open('/tmp/sample20.json'))]"))
cats=($(python3 -c "import json; [print(x['cat']) for x in json.load(open('/tmp/sample20.json'))]"))

i=0
for id in "${ids[@]}"; do
  url="https://tabidokoiko.com/destinations/$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$id")/"
  printf "[%02d/20] %s %s\n" "$((i+1))" "${cats[$i]}" "$id"
  xcrun simctl openurl $DEVICE "$url"
  sleep 6
  xcrun simctl io $DEVICE screenshot "/tmp/shots20/$(printf '%02d' $((i+1)))_${cats[$i]}_${id//\//_}.png" 2>/dev/null
  i=$((i+1))
done

# トップ検索
echo "[21/21] トップ検索（高松/1泊/温泉）"
xcrun simctl openurl $DEVICE "https://tabidokoiko.com/?from=%E9%AB%98%E6%9D%BE&nights=1night&theme=%E6%B8%A9%E6%B3%89"
sleep 10
xcrun simctl io $DEVICE screenshot "/tmp/shots20/21_search.png" 2>/dev/null
ls /tmp/shots20/ | wc -l
