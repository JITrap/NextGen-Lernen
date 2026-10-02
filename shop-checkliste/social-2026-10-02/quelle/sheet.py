import sys,glob
from PIL import Image,ImageDraw
pat,out,tw=sys.argv[1],sys.argv[2],int(sys.argv[3]) if len(sys.argv)>3 else 270
fs=sorted(glob.glob(pat),key=lambda f:float(f.rsplit('_',1)[1][:-4]))
ims=[Image.open(f) for f in fs]; w,h=ims[0].size; th=int(tw*h/w)
cols=min(5,len(ims)); rows=(len(ims)+cols-1)//cols
s=Image.new('RGB',(cols*(tw+2),rows*(th+2)),'white')
for i,im in enumerate(ims):
  x,y=(i%cols)*(tw+2),(i//cols)*(th+2); s.paste(im.convert('RGB').resize((tw,th),Image.LANCZOS),(x,y)); ImageDraw.Draw(s).text((x+4,y+4),fs[i].rsplit('_',1)[1][:-4],fill='yellow')
s.save(out,quality=85)
