import sys
import time
import json
import urllib.request

run_id = "28910398536"
token = "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"
url = f"https://api.github.com/repos/AdiMadhu999/Missiongrid2/actions/runs/{run_id}"

print(f"Monitoring GitHub Action Build Run ID: {run_id}...")

start_time = time.time()
while True:
    try:
        req = urllib.request.Request(url)
        req.add_header("Authorization", f"token {token}")
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            status = data.get("status")
            conclusion = data.get("conclusion")
            
            elapsed = int(time.time() - start_time)
            print(f"[{elapsed}s] Build Status: {status} | Conclusion: {conclusion}")
            
            if status == "completed":
                print(f"Workflow finished with conclusion: {conclusion}")
                if conclusion == "success":
                    sys.exit(0)
                else:
                    sys.exit(1)
    except Exception as e:
        print("Polling error:", e)
    
    time.sleep(20)
