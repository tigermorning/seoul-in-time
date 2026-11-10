import re,html,json,urllib.parse
from s import get
allr={}
def page(q,p):
    h=get("https://museum.seoul.go.kr/archive/search/NR_search.do?query="+urllib.parse.quote(q)+"&collection=archive&q_rowPerPage=100&currentPage=%d"%p)
    n=0
    for li in h.split('<li class="result-item">')[1:]:
        m=re.search(r'href="([^"]+)"',li)
        dd=[re.sub(r'<[^>]+>|\s+',' ',html.unescape(x)).strip() for x in re.findall(r'<dd>(.*?)</dd>',li,flags=re.S)]
        if m: allr[dd[-1]]=[m.group(1).replace('&amp;','&')]+dd;n+=1
    return n
qs="시장 다리 교 천 역 정류장 학교 교회 성당 목욕 골목 공원 주택 마을 거리 가게 상가 한옥 사찰 시가지 전경 광장 로 동 구 서울 풍경 철도 버스 전차 극장 이발 대장간 제재소 나루 하천 개천 도로".split()
for q in qs:
    for p in range(1,12):
        try:n=page(q,p)
        except Exception as e: print(q,p,e);break
        if n<100:break
    print(q,len(allr),flush=True)
json.dump(allr,open("all2.json","w",encoding="utf-8"),ensure_ascii=False)
