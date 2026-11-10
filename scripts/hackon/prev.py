import sys, os, io, ssl, urllib.request
from PIL import Image
ctx = ssl.create_default_context(); ctx.set_ciphers('DEFAULT:@SECLEVEL=1')
ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
for arg in sys.argv[2:]:
    name, url = arg.split('=', 1)
    raw = os.path.join(out, name + '.orig.jpg')
    if not os.path.exists(raw):
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        open(raw, 'wb').write(urllib.request.urlopen(req, context=ctx, timeout=120).read())
    im = Image.open(raw).convert('RGB'); im.thumbnail((1400, 1400))
    im.save(os.path.join(out, name + '.prev.jpg'), quality=85)
    print(name, im.size)
