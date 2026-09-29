import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile
SR=44100; DUR=98.0; N=int(SR*DUR); BPM=120; BEAT=60/BPM
rng=np.random.default_rng(3)
L=np.zeros(N); R=np.zeros(N)
def add(sig,t,gain=1.0,pan=0.0):
    i=int(t*SR)
    if i>=N: return
    s=sig[:N-i]*gain
    L[i:i+len(s)]+=s*np.sqrt(0.5*(1-pan)); R[i:i+len(s)]+=s*np.sqrt(0.5*(1+pan))
def env(n,a=0.002,d=0.2):
    t=np.arange(n)/SR; e=np.exp(-t/d); na=int(a*SR)
    if na>0: e[:na]*=np.linspace(0,1,na)
    return e
def lp(x,f,o=2): return sosfilt(butter(o,f,'low',fs=SR,output='sos'),x)
def hp(x,f,o=2): return sosfilt(butter(o,f,'high',fs=SR,output='sos'),x)
def bp(x,f1,f2): return sosfilt(butter(2,[f1,f2],'band',fs=SR,output='sos'),x)
def midi(m): return 440*2**((m-69)/12)
# instruments
def kick(big=False):
    n=int(.5*SR); t=np.arange(n)/SR
    f=50+ (160 if big else 120)*np.exp(-t*28); ph=2*np.pi*np.cumsum(f)/SR
    s=np.sin(ph)*env(n,.001,.35 if big else .22); s+= .3*lp(rng.standard_normal(n),3000)*env(n,.0005,.006)
    return np.tanh(s*1.6)
def clap():
    n=int(.35*SR); x=bp(rng.standard_normal(n),900,4000); e=np.zeros(n)
    for k,o in enumerate([0,.011,.022]): i=int(o*SR); e[i:]+=env(n-i,.0005,.012 if k<2 else .14)
    return x*e*0.9
def hat(open_=False):
    n=int((.3 if open_ else .06)*SR); x=hp(rng.standard_normal(n),7000)
    return x*env(n,.0005,.08 if open_ else .018)*.5
def saw(f,n,det=0.0):
    t=np.arange(n)/SR; out=np.zeros(n)
    for d in ([-det,0,det] if det else [0]):
        ph=(t*f*(1+d))%1; out+=2*ph-1
    return out/(3 if det else 1)
def bass(m,dur,cut=900):
    n=int(dur*SR); s=saw(midi(m),n)+.6*np.sin(2*np.pi*midi(m-12)*np.arange(n)/SR)
    return np.tanh(lp(s,cut,2)*1.4)*env(n,.003,dur*0.8)
def stab(ms,dur,cut=2500):
    n=int(dur*SR); s=sum(saw(midi(m),n,.006) for m in ms)/len(ms)
    return lp(s,cut)*env(n,.002,dur*.5)
def pad(ms,dur,cut=1200):
    n=int(dur*SR); s=sum(saw(midi(m),n,.004) for m in ms)/len(ms)
    e=np.minimum(1,np.minimum(np.arange(n)/(.4*SR),(n-np.arange(n))/(.6*SR)))
    return lp(s,cut)*e
def riser(dur,f0=300,f1=8000):
    n=int(dur*SR); x=rng.standard_normal(n); out=np.zeros(n); seg=2048
    for i in range(0,n,seg):
        fr=f0*(f1/f0)**(i/n); out[i:i+seg]=bp(x[i:i+seg],fr*.7,min(fr*1.4,20000))
    return out*np.linspace(0,1,n)**2*.9
def impact():
    n=int(2.2*SR); t=np.arange(n)/SR
    boom=np.sin(2*np.pi*np.cumsum(40+60*np.exp(-t*6))/SR)*env(n,.001,.9)
    noise=lp(rng.standard_normal(n),2500)*env(n,.001,.35)
    return np.tanh((boom*1.2+noise*.6))
def whoosh(dur=.35):
    n=int(dur*SR); x=rng.standard_normal(n); out=np.zeros(n); seg=1024
    for i in range(0,n,seg):
        p=i/n; fr=400+6000*np.sin(np.pi*p); out[i:i+seg]=bp(x[i:i+seg],fr*.6,min(fr*1.6,20000))
    return out*np.sin(np.pi*np.linspace(0,1,n))*.6
def tick():
    n=int(.03*SR); return np.sin(2*np.pi*2400*np.arange(n)/SR)*env(n,.0005,.006)*.35

K=kick(); KB=kick(True); C=clap(); H=hat(); HO=hat(True); IMP=impact()
# harmony: Am F C G  (per bar = 2s)
CH=[[57,60,64],[53,57,60],[48,52,55],[55,59,62]]; ROOT=[33,29,36,31]
def bar_of(t): return int(t//2)%4

full=[(16,52),(54,76),(82,90)]
def in_(t,rs): return any(a<=t<b for a,b in rs)
beats=np.arange(0,DUR,BEAT/4)  # 16ths
for t in beats:
    q=round(t/(BEAT/4)); b16=q%4; beat=q//4
    br=bar_of(t)
    if in_(t,full) or 52<=t<54:
        if b16==0: add(K,t,.95)
        if b16==0 and beat%2==1: add(C,t,.55,.1)
        if b16==2: add(HO,t,.28,-.3)
        add(H,t,.22 if b16%2 else .12,.35)
        # rolling bass offbeats
        if b16 in (1,2,3): add(bass(ROOT[br]+ (12 if b16==2 else 0),BEAT/4*.95,700+400*(b16==2)),t,.34)
        if q%8==0: add(stab(CH[br],.35,2800),t,.12,-.2); add(stab([m+12 for m in CH[br]],.25,4000),t+BEAT*1.5,.07,.3)
    elif 12<=t<16:  # half-time
        if q%8==0: add(KB,t,.9)
        if q%16==8: add(C,t,.5)
        if b16==2: add(H,t,.15)
    elif 8<=t<12:   # build
        if b16==0: add(K,t,.5+.4*(t-8)/4)
        add(H,t,.05+.12*(t-8)/4,.3)
        if b16==2: add(bass(ROOT[br],BEAT/4,300+500*(t-8)/4),t,.3)
    elif 76<=t<82:  # breakdown
        if b16==2 and t>=79: add(H,t,.1)
    elif t<4:
        if b16==0: add(tick(),t,.6)
    if 54<=t<76 or 82<=t<90:  # arp lead
        ar=CH[br]+[CH[br][0]+12]; m=ar[q%4]+12
        n=int(BEAT/4*SR); s=lp(saw(midi(m),n,.003),3500)*env(n,.002,.07)
        add(s,t,.09,.4 if q%2 else -.4)
# word-cut hits 4-8
for i in range(8):
    t=4+i*.5; add(KB,t,.9); add(bass(ROOT[0]+(0 if i%2==0 else 7),.45,500),t,.35); add(whoosh(.25),t-.12,.3)
# snare rolls
for a,b in [(11,12),(52,54),(80.5,82)]:
    n=int((b-a)*8)
    for k in range(n*2):
        t=a+k*(b-a)/(n*2); add(C,t,.15+.4*k/(n*2))
# risers
for a,b in [(2,4),(9,12),(51,54),(78,82),(88,90)]: add(riser(b-a),a,.35)
# pads
for t0 in np.arange(0,98,2):
    br=bar_of(t0); cut=500 if t0<8 else (900 if 76<=t0<82 else 1400)
    g=.10 if (t0<16 or 76<=t0<82 or t0>=90) else .06
    if t0>=96: continue
    add(pad([m-12 for m in CH[br]]+[CH[br][0]],2.1,cut),t0,g)
# drone intro
n=int(8*SR); tt=np.arange(n)/SR; dr=np.sin(2*np.pi*55*tt)*.25+lp(saw(55,n),200)*.3; dr*=np.minimum(1,tt/2)*np.minimum(1,(8-tt)/1)
add(dr,0,.5)
# impacts & whooshes
for t in [12,16,20,54,64,82,90]: add(IMP,t,.55)
for t in [23,25,27,30,33,36,39,42,45,48,51.5,56,62,67,70,73,76]: add(whoosh(),t-.18,.35,((t*7)%2)-1); add(KB,t,.4)
# final
add(IMP,96,.3)
# reverb send (simple)
ir_n=int(1.6*SR); ir=rng.standard_normal(ir_n)*np.exp(-np.arange(ir_n)/SR/0.45); ir=lp(ir,5000)*0.02
L2=L+fftconvolve(L,ir)[:N]*0.9; R2=R+fftconvolve(R,ir[::-1].copy()*0+np.roll(ir,300))[:N]*0.9
# master: fade out end, limiter-ish
mix=np.stack([L2,R2],1)
fade=np.ones(N); fs=int(92*SR); fade[fs:]=np.linspace(1,0,N-fs)**1.5; mix*=fade[:,None]
mix=hp(mix.T,30).T
mix=np.tanh(mix*1.3)/np.tanh(1.3)
mix/=np.max(np.abs(mix))*1.05
wavfile.write('music.wav',SR,(mix*32767).astype(np.int16))
print('ok',mix.shape)
