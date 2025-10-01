import json, httpx, sys
payload = { messages:[{role:user,content:ping primary probe}]}
try:
    r = httpx.post(http://localhost:8000/chat, json=payload, timeout=120)
    print(STATUS, r.status_code)
    txt = r.text
    print(RAW, txt[:400].replace('\n',' '))
    try:
        j = r.json()
        print(_served_by, j.get(_served_by))
    except Exception as je:
        print(JSON_PARSE_ERR, je)
except Exception as e:
    print(REQ_ERR, type(e).__name__, e)
