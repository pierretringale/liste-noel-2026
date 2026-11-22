import random
random.seed(21)
W, H = 1280, 260
PAPER = '#f6efe0'
INK = {  # colour, print offset (mis-registration), grain filter
 'navy':   ('#141d52', (0.0, 0.0), 'gN'),
 'blue':   ('#5b8fe0', (0.7, 0.5), 'gB'),
 'red':    ('#ee5a40', (1.0, -0.7), 'gR'),
 'yellow': ('#ffd23f', (-0.8, 0.6), 'gY'),
 'green':  ('#557d3a', (0.4, 0.6), 'gB'),
 'plum':   ('#8a3440', (1.0, -0.7), 'gR'),
 'grey':   ('#dcdfe9', (1.0, -0.7), 'gR'),
 'shade':  ('#9299b6', (1.0, -0.7), 'gR'),
}
o = []; a = o.append
def P(*pts): return 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + ' Z'
def R(x, y, w, h): return P((x, y), (x+w, y), (x+w, y+h), (x, y+h))
def E(cx, cy, rx, ry): return f'M{cx-rx:.1f} {cy:.1f} a{rx:.1f} {ry:.1f} 0 1 0 {2*rx:.1f} 0 a{rx:.1f} {ry:.1f} 0 1 0 {-2*rx:.1f} 0 Z'
def paper(d): a(f'<path d="{d}" fill="{PAPER}"/>')
def tone(d, pat): a(f'<path d="{d}" fill="url(#{pat})"/>')
def shape(d, ink, under=PAPER):
    col, (dx, dy), f = INK[ink]
    if under: a(f'<path d="{d}" fill="{under}"/>')
    a(f'<g transform="translate({dx},{dy})" filter="url(#{f})"><path d="{d}" fill="{col}"/></g>')

def grain(fid, seed, c):
    return f'''<filter id="{fid}" x="-2%" y="-2%" width="104%" height="104%">
 <feTurbulence type="fractalNoise" baseFrequency="1.25" numOctaves="2" seed="{seed}" result="n"/>
 <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  9 0 0 0 {c}" result="m"/>
 <feComposite in="SourceGraphic" in2="m" operator="in"/>
</filter>'''
def dots(pid, col, period, r, rot):
    return f'<pattern id="{pid}" width="{period}" height="{period}" patternUnits="userSpaceOnUse" patternTransform="rotate({rot})"><circle cx="{period/2}" cy="{period/2}" r="{r}" fill="{col}"/></pattern>'

a(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W*2}" height="{H*2}">')
a('<defs>')
a(grain('gN', 3, -2.55)); a(grain('gB', 8, -2.9)); a(grain('gR', 14, -2.95)); a(grain('gY', 19, -2.8))
a(dots('hB0', '#5b8fe0', 3.4, 0.62, 45)); a(dots('hB', '#5b8fe0', 3.4, 0.98, 45)); a(dots('hB2', '#5b8fe0', 3.2, 1.3, 45))
a(dots('hN', '#141d52', 3.0, 0.62, 75)); a(dots('hY', '#ffbf1f', 3.2, 1.0, 15))
a('<filter id="wob" x="-1%" y="-6%" width="102%" height="112%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="11" result="w"/><feDisplacementMap in="SourceGraphic" in2="w" scale="1.6" xChannelSelector="R" yChannelSelector="G"/></filter>')
a('<filter id="far" x="-5%" y="-30%" width="110%" height="160%"><feGaussianBlur stdDeviation="0.7"/></filter>')
# sea mask: streaks where the navy ink lets the blue show through
m = ['<mask id="seaM" maskUnits="userSpaceOnUse" x="0" y="150" width="1280" height="112"><rect x="0" y="150" width="1280" height="112" fill="#fff"/>']
for i in range(120):
    u = random.random()
    y = 155 + 102*(u**1.5)
    rx = 5 + 30*random.random()*(0.35+u)
    ry = 0.55 + 0.9*u*random.random()
    x = random.uniform(540, 1290)
    m.append(f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{rx:.1f}" ry="{ry:.2f}" fill="#000"/>')
m.append('</mask>')
a(''.join(m))
a('</defs>')
a('<g filter="url(#wob)">')

# --- sea: blue under, navy over, the moon's path in yellow
a('<rect x="0" y="150" width="1280" height="112" fill="#3f66bd"/>')
a('<g filter="url(#gN)"><rect x="0" y="152.5" width="1280" height="110" fill="#141d52" mask="url(#seaM)"/></g>')
mx = 1114
for i in range(22):
    y = 155 + i*3.9 + random.uniform(-.8, .8)
    w = 7 + i*2.9 + random.uniform(-5, 7)
    x = mx + random.uniform(-1, 1)*(2+i*1.2)
    shape(E(x, y, w/2, random.uniform(.8, 1.35)), 'yellow')

# --- far hill on the left (hides the sea there), printed as a blue screen
far = 'M-30 122 C50 106 130 106 205 116 C270 124 322 133 380 151 C430 165 480 177 540 188 L540 270 L-30 270 Z'
paper(far); tone(far, 'hB2')

def small_house(x, base, w, h, rh, ink, chimney=True, wins=2, door=True, far=False):
    g = w*0.5; top = base - h
    if chimney:
        cx = x + w*0.35; cy = top - rh*0.7
        shape(R(cx, cy-8, 8, 14), 'navy', under=None)
        paper(E(cx+4, cy-8, 6, 2.4))
    side = P((x, top+1), (x+w, top), (x+w, base), (x, base-1))
    gable = P((x+w, top), (x+w+g/2, top-rh), (x+w+g, top+2), (x+w+g, base+1), (x+w, base))
    shape(side, ink); tone(side, 'hN'); shape(gable, ink)
    rl = (x+g/2-3, top-rh-1); pk = (x+w+g/2+1, top-rh-3)
    paper(f'M{rl[0]:.1f} {rl[1]:.1f} L{pk[0]:.1f} {pk[1]:.1f} L{pk[0]+4:.1f} {pk[1]+3:.1f} L{x+w-2:.1f} {top+5:.1f} Q{x+w*.72:.1f} {top+10:.1f} {x+w*.48:.1f} {top+6:.1f} Q{x+w*.24:.1f} {top+11:.1f} {x-5:.1f} {top+7:.1f} Z')
    roof = f'M{rl[0]:.1f} {rl[1]:.1f} L{pk[0]:.1f} {pk[1]:.1f} L{pk[0]+4:.1f} {pk[1]+3:.1f} L{x+w-2:.1f} {top+5:.1f} Q{x+w*.72:.1f} {top+10:.1f} {x+w*.48:.1f} {top+6:.1f} Q{x+w*.24:.1f} {top+11:.1f} {x-5:.1f} {top+7:.1f} Z'
    if far: tone(roof, 'hB0')
    paper(P((pk[0]-1, pk[1]+1), (pk[0]+3, pk[1]), (x+w+g+5, top+5), (x+w+g+1, top+8)))
    ww = max(5, w*0.17); wh = ww*1.15; wy = top + h*0.38
    for wx in [x + w*0.2, x + w*0.62][:wins]:
        shape(R(wx, wy, ww, wh), 'yellow')
    shape(R(x + w + g*0.34, wy+1, ww*.8, wh), 'yellow')
    if door:
        shape(R(x + w*0.43, base-h*0.5, ww*.9, h*0.5-1), 'navy', under=None)
    paper(f'M{x-6:.1f} {base+1:.1f} Q{x+w*.5:.1f} {base-4:.1f} {x+w+g+6:.1f} {base+2:.1f} Q{x+w*.5:.1f} {base+6:.1f} {x-6:.1f} {base+1:.1f} Z')

def tiny_pine(cx, base, hgt, half):
    for t in range(3):
        y0 = base - hgt + hgt*t*0.26; y1 = base - hgt + hgt*(t+1.3)*0.3; hw = half*(t+1.2)/3.2
        shape(P((cx, y0), (cx+hw, y1), (cx-hw, y1)), 'green')
        paper(P((cx, y0), (cx+hw, y1), (cx+hw*.2, y1-hw*.5)))

# village, far row (softer) then nearer row
a('<g filter="url(#far)">')
small_house(6, 121, 26, 15, 11, 'blue', far=True)
small_house(60, 116, 24, 14, 11, 'blue', far=True)
shape(P((112, 84), (127, 85), (127, 119), (112, 118)), 'blue')
shape(P((110.5, 86), (118.5, 60), (128.5, 87)), 'navy', under=None)
paper(P((118.5, 59), (130, 88.5), (126.5, 87.5)))
a('<path d="M118.5 59 V50 M115.3 53.2 H121.7" stroke="#ffd23f" stroke-width="1.5" fill="none"/>')
shape(R(116, 93, 5, 10), 'yellow')
small_house(127, 118, 28, 15, 12, 'blue', chimney=False, door=False, far=True)
small_house(180, 121, 24, 14, 11, 'blue', far=True)
small_house(230, 128, 24, 14, 10, 'blue', far=True)
small_house(276, 137, 20, 13, 10, 'blue', far=True)
tiny_pine(50, 122, 20, 8); tiny_pine(170, 122, 18, 7); tiny_pine(222, 128, 16, 6)
a('</g>')
a('<g>')
small_house(26, 143, 32, 18, 14, 'red')
small_house(92, 140, 30, 17, 13, 'blue')
small_house(154, 144, 30, 17, 13, 'blue')
small_house(214, 151, 28, 16, 12, 'red')
tiny_pine(82, 146, 24, 9); tiny_pine(144, 148, 22, 8); tiny_pine(204, 154, 20, 8); tiny_pine(268, 158, 22, 8)
a('</g>')

# --- headland: bare paper, shadows as blue screens
paper('M-10 206 C110 196 220 181 340 179 C470 177 570 183 668 196 C748 207 812 222 880 242 L900 262 L-10 262 Z')
tone(P((330, 189), (214, 206), (232, 214), (360, 197)), 'hB')
tone(P((262, 193), (176, 205), (188, 211), (276, 199)), 'hB')
tone('M560 191 C640 196 740 210 838 236 C760 222 660 210 566 204 Z', 'hB0')

# --- the cottage: smooth red walls, snow, yellow windows
for (cx, cy, r) in [(401, 57, 2.8), (405, 48, 3.6), (400, 37, 4.6)]:
    a(f'<path d="{E(cx, cy, r, r*.92)}" fill="{PAPER}" opacity=".7"/>')
ch_front = P((390, 68), (406, 67), (406, 100), (390, 101)); ch_side = P((406, 67), (414, 69), (414, 99), (406, 100))
shape(ch_front, 'red'); tone(ch_front, 'hN'); shape(ch_side, 'red')
paper('M387 69 Q398 58 417 69 Q410 74 400 72 Q392 74 387 69 Z')
side = P((330, 132), (476, 128), (476, 190), (330, 188))
gable = P((476, 128), (512, 90), (548, 134), (548, 192), (476, 190))
shape(side, 'grey'); tone(side, 'hN'); shape(gable, 'grey')
shape(P((330, 133), (476, 129), (476, 139), (330, 143)), 'shade', under=None)
shape(P((476, 129), (512, 92), (548, 135), (548, 140), (512, 99), (476, 136)), 'shade', under=None)
shape(P((366, 94), (512, 90), (470, 134), (322, 138)), 'navy', under=None)
paper('M360 91 L514 84 L520 90 L474 138 Q452 146 430 139 Q408 147 386 141 Q362 149 340 143 Q326 147 316 140 Z')
tone('M316 140 Q326 147 340 143 Q362 149 386 141 Q408 147 430 139 Q452 146 474 138 L477 130 L320 134 Z', 'hB')
paper('M510 86 Q518 84 522 92 L560 138 Q558 146 550 143 L512 98 Z')
tone('M548 141 L558 139 L560 138 Q558 146 550 143 Z', 'hB')
def window(x, y, w, h, skew):
    a(f'<g transform="translate({x},{y}) skewY({skew})">')
    a(f'<rect x="-3" y="-3" width="{w+6}" height="{h+6}" fill="{PAPER}"/>')
    a(f'<g transform="translate(-0.8,0.6)" filter="url(#gY)"><rect x="0" y="0" width="{w}" height="{h}" fill="#ffd23f"/></g>')
    a(f'<g filter="url(#gN)"><path d="M{w/2} 0V{h} M0 {h*.45}H{w}" stroke="#141d52" stroke-width="1.8" fill="none"/></g>')
    a(f'<path d="M-5 {h+2.5} Q{w/2} {h-3} {w+5} {h+2.5} L{w+5} {h+6} L-5 {h+6} Z" fill="{PAPER}"/>')
    a('</g>')
window(352, 148, 26, 25, -1.5); window(428, 146, 26, 25, -1.5); window(503, 151, 18, 25, 4.5)
paper(E(512, 114, 7.6, 7.6)); shape(E(512, 114, 5, 5), 'yellow', under=None)
# door: navy, wreath, lamp
a(f'<g transform="translate(392,151) skewY(-1.5)"><rect x="-3" y="-3" width="26" height="42" fill="{PAPER}"/><g filter="url(#gN)"><rect x="0" y="0" width="20" height="38" fill="#141d52"/></g><circle cx="10" cy="13" r="5.4" fill="none" stroke="#557d3a" stroke-width="3.4"/><circle cx="10" cy="18.4" r="1.9" fill="#ee5a40"/><path d="M-4 -3 Q10 -9 24 -3 Z" fill="{PAPER}"/></g>')
paper(E(402, 143.5, 5.6, 5.0)); shape(E(402, 143.5, 3.6, 3.2), 'yellow', under=None)
# snow against the walls, window light on the snow as a yellow screen
paper('M318 190 Q350 181 390 187 Q402 191 414 187 Q450 181 478 188 Q520 184 556 192 Q570 198 552 201 L326 200 Q310 196 318 190 Z')
for (cx, cy, rx) in [(365, 204, 30), (441, 202, 30), (402, 206, 18), (520, 205, 20)]:
    tone(E(cx, cy, rx, 6.5), 'hY')

# --- pines
lights = []
def pine(cx, base, top, half, lit=False):
    tiers = 4
    shape(R(cx-3, base-10, 6, 13), 'navy', under=None)
    hh = base - 8 - top
    for t in range(tiers):
        y0 = top + hh*(t/tiers)*0.86
        y1 = min(top + hh*((t+1.25)/tiers), base-6)
        hw = half*((t+1.3)/(tiers+.3))
        shape(f'M{cx} {y0:.1f} L{cx+hw:.1f} {y1:.1f} Q{cx} {y1+hw*.22:.1f} {cx-hw:.1f} {y1:.1f} Z', 'green')
        paper(f'M{cx} {y0:.1f} L{cx+hw*.98:.1f} {y1-1:.1f} Q{cx+hw*.55:.1f} {y1-hw*.18:.1f} {cx+hw*.2:.1f} {y1-hw*.36:.1f} Q{cx+hw*.1:.1f} {y0+(y1-y0)*.45:.1f} {cx-hw*.12:.1f} {y0+(y1-y0)*.3:.1f} Z')
        if lit:
            for k in range(2):
                lights.append((cx - hw*.75 + random.random()*hw*.7, y1 - 3 - random.random()*(y1-y0)*.3, random.choice(['#ffd23f', '#ee5a40', '#ffd23f'])))
pine(262, 196, 92, 36, lit=True)
for (lx, ly, c) in lights:
    a(f'<circle cx="{lx:.1f}" cy="{ly:.1f}" r="2.6" fill="{PAPER}"/><circle cx="{lx-.5:.1f}" cy="{ly+.4:.1f}" r="1.9" fill="{c}"/>')
shape('M262 84 L264 89.5 L269.5 91 L264 92.5 L262 98 L260 92.5 L254.5 91 L260 89.5 Z', 'yellow')
pine(606, 200, 138, 22); pine(642, 205, 158, 15)

# --- fence
pts = [(566, 194), (590, 197), (614, 201), (638, 205), (662, 210), (686, 216), (710, 222)]
f = ['<g filter="url(#gN)">']
for i, (x, y) in enumerate(pts):
    f.append(f'<path d="M{x} {y+2} V{y-13}" stroke="#141d52" stroke-width="3.2" stroke-linecap="round"/>')
    if i < len(pts)-1:
        x2, y2 = pts[i+1]
        f.append(f'<path d="M{x} {y-9} L{x2} {y2-9} M{x} {y-4} L{x2} {y2-4}" stroke="#141d52" stroke-width="1.7"/>')
f.append('</g>')
a(''.join(f))
for (x, y) in pts: paper(E(x, y-13.6, 3.3, 2.1))

# --- foreground snowbank (meets the ribbon), with a screened shadow behind its crest
tone('M-10 230 C150 218 330 238 520 230 C700 222 800 236 880 240 L880 252 L-10 252 Z', 'hB0')
paper('M-10 238 C150 226 330 246 520 238 C700 230 800 244 960 247 C1080 249 1180 240 1290 244 L1290 262 L-10 262 Z')
a('</g></svg>')
svg = '\n'.join(o)
open('scene.svg', 'w').write(svg)
open('scene.html', 'w').write('<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body>' + svg + '</body></html>')
