import ssl,urllib.request,urllib.parse,sys,re
ctx=ssl.create_default_context();ctx.set_ciphers("DEFAULT:@SECLEVEL=1");ctx.check_hostname=False;ctx.verify_mode=ssl.CERT_NONE
def get(u):
    r=urllib.request.Request(u,headers={"User-Agent":"Mozilla/5.0"})
    return urllib.request.urlopen(r,context=ctx,timeout=30).read().decode("utf-8","replace")
if __name__=="__main__":
    q=sys.argv[1]
    h=get("https://museum.seoul.go.kr/archive/search/NR_search.do?query="+urllib.parse.quote(q)+"&collection=seoulPicture&q_rowPerPage=100")
    open("out.html","w",encoding="utf-8").write(h)
    print(len(h))
    m=re.search(r"총\s*([\d,]+)",h);print(m.group(0) if m else None)
