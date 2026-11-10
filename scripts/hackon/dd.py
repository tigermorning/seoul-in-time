import re,sys,html,json,struct,ssl,urllib.request
from s import get,ctx
A=json.load(open("all2.json",encoding="utf-8"))
def t(x): return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',x))).strip()
def jpgsize(u):
    try:
        r=urllib.request.Request(u,headers={"User-Agent":"Mozilla/5.0"})
        d=urllib.request.urlopen(r,context=ctx,timeout=40).read()
        i=2
        while i<len(d):
            if d[i]!=0xFF:i+=1;continue
            m=d[i+1]
            if m in(0xC0,0xC1,0xC2): h,w=struct.unpack(">HH",d[i+5:i+9]);return f"{w}x{h} ({len(d)//1024}KB)"
            i+=2+struct.unpack(">H",d[i+2:i+4])[0]
    except Exception as e: return "ERR "+str(e)
def detail(fid):
    n=fid.split('-')[-1]
    u=A[fid][0] if fid in A else f"https://museum.seoul.go.kr/archive/archiveNew/NR_archiveView.do?ctgryId=CTGRY{n}&type=D&fileSn=300&upperNodeId=CTGRY{n}&fileId={fid}"
    h=get(u)
    img=re.search(r'class="img-area".*?<img[^>]*src="([^"]+)"',h,flags=re.S)
    op=re.search(r'class="opencode_box_con">(.*?)</div>',h,flags=re.S)
    T=t(h); j=T.find('명칭 ')
    body=T[j:T.find('다운로드',j)] if j>=0 else ''
    k=re.search(r'공공누리 제\d유형[^)]*\)',body)
    return dict(fid=fid,url=u,body=body[:1500],kogl=k.group(0) if k else None,img=img.group(1) if img else None)
if __name__=="__main__":
    for f in sys.argv[1:]:
        d=detail(f); d['size']=jpgsize(d['img']) if d['img'] else None
        print(json.dumps(d,ensure_ascii=False));print()
