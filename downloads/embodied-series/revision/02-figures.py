# SPDX-License-Identifier: MIT
"""Reproducible numerical illustrations for the embodied-intelligence series.
The formulas are cited in the per-article JSON output. This plotting code is
new code, not code copied from a textbook. Python standard library only.
Usage: python FILE.py --asset-dir figures --data-dir data
"""
import argparse, csv, html, json, math
from pathlib import Path

BLUE="#2563a6"; RED="#c74b35"; GREEN="#287f64"; GRAY="#667085"
class SVG:
    def __init__(self,w,h,title):
        self.w=w; self.h=h; self.parts=[]
        self.parts.append('<rect width="100%" height="100%" fill="#ffffff"/>')
        self.text(w/2,32,title,22,anchor="middle",bold=True)
    def text(self,x,y,s,size=16,color="#243248",anchor="start",bold=False):
        weight="bold" if bold else "normal"
        self.parts.append(f'<text x="{x:.3f}" y="{y:.3f}" font-size="{size}" fill="{color}" text-anchor="{anchor}" font-weight="{weight}">{html.escape(str(s))}</text>')
    def line(self,x1,y1,x2,y2,color=GRAY,width=1.5,dash=""):
        d=f' stroke-dasharray="{dash}"' if dash else ""
        self.parts.append(f'<line x1="{x1:.3f}" y1="{y1:.3f}" x2="{x2:.3f}" y2="{y2:.3f}" stroke="{color}" stroke-width="{width}"{d}/>')
    def poly(self,pts,color=BLUE,width=2.5,dash=""):
        d=f' stroke-dasharray="{dash}"' if dash else ""
        p=" ".join(f"{x:.3f},{y:.3f}" for x,y in pts)
        self.parts.append(f'<polyline points="{p}" fill="none" stroke="{color}" stroke-width="{width}"{d}/>')
    def circle(self,x,y,r=4,color=BLUE):
        self.parts.append(f'<circle cx="{x:.3f}" cy="{y:.3f}" r="{r}" fill="{color}"/>')
    def arrow(self,x1,y1,x2,y2,color=BLUE,width=2.5):
        self.line(x1,y1,x2,y2,color,width)
        a=math.atan2(y2-y1,x2-x1); size=9
        pts=[(x2,y2),(x2-size*math.cos(a-.45),y2-size*math.sin(a-.45)),(x2-size*math.cos(a+.45),y2-size*math.sin(a+.45))]
        p=" ".join(f"{x:.3f},{y:.3f}" for x,y in pts)
        self.parts.append(f'<polygon points="{p}" fill="{color}"/>')
    def write(self,path):
        top=f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}" role="img" font-family="Arial, sans-serif">'
        Path(path).write_text(top+"\n"+"\n".join(self.parts)+"\n</svg>\n",encoding="utf-8")

def axes(s,box,xlim,ylim,xticks,yticks,xlabel="",ylabel=""):
    x,y,w,h=box
    def xy(a,b):
        return x+(a-xlim[0])/(xlim[1]-xlim[0])*w,y+h-(b-ylim[0])/(ylim[1]-ylim[0])*h
    for a,label in xticks:
        px,py=xy(a,ylim[0]); s.line(px,y,px,y+h,"#e8ecf1",1); s.text(px,y+h+24,label,14,anchor="middle")
    for b,label in yticks:
        px,py=xy(xlim[0],b); s.line(x,py,x+w,py,"#e8ecf1",1); s.text(x-10,py+5,label,14,anchor="end")
    s.line(x,y+h,x+w,y+h,"#566277",1.4); s.line(x,y,x,y+h,"#566277",1.4)
    if xlim[0]<0<xlim[1]:
        px,_=xy(0,0); s.line(px,y,px,y+h,"#b6bec9",1.2)
    if ylim[0]<0<ylim[1]:
        _,py=xy(0,0); s.line(x,py,x+w,py,"#b6bec9",1.2)
    if xlabel:s.text(x+w/2,y+h+50,xlabel,16,anchor="middle")
    if ylabel:s.text(x,y-12,ylabel,16)
    return xy

def save_json(path,data):
    Path(path).write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
def save_csv(path,header,rows):
    with Path(path).open("w",newline="",encoding="utf-8") as f:
        writer=csv.writer(f); writer.writerow(header); writer.writerows(rows)
def args():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--asset-dir",type=Path,default=Path("figures"))
    p.add_argument("--data-dir",type=Path,default=Path("data"))
    a=p.parse_args(); a.asset_dir.mkdir(parents=True,exist_ok=True); a.data_dir.mkdir(parents=True,exist_ok=True); return a
def mv(A,x):return [sum(a*b for a,b in zip(row,x)) for row in A]
def mm(A,B):return [[sum(A[i][k]*B[k][j] for k in range(len(B))) for j in range(len(B[0]))] for i in range(len(A))]
def tr(A):return [list(col) for col in zip(*A)]
def norm(x):return math.sqrt(sum(a*a for a in x))
def frob(A):return norm([a for row in A for a in row])

def rx(t):
    c,s=math.cos(t),math.sin(t); return [[1,0,0],[0,c,-s],[0,s,c]]
def ry(t):
    c,s=math.cos(t),math.sin(t); return [[c,0,s],[0,1,0],[-s,0,c]]
def rz(t):
    c,s=math.cos(t),math.sin(t); return [[c,-s,0],[s,c,0],[0,0,1]]
def orth_error(R):
    P=mm(tr(R),R); return frob([[P[i][j]-(1 if i==j else 0) for j in range(3)] for i in range(3)])
def main():
    a=args(); angle=math.pi/2; point=[1.,1.,0.]
    xy=mv(mm(ry(angle),rx(angle)),point); yx=mv(mm(rx(angle),ry(angle)),point)
    assert norm([x-y for x,y in zip(xy,[1,0,-1])])<1e-12
    assert norm([x-y for x,y in zip(yx,[0,1,1])])<1e-12
    assert abs(norm(xy)-norm(point))<1e-12 and abs(norm(yx)-norm(point))<1e-12
    R=rz(angle); L=[[1,-angle,0],[angle,1,0],[0,0,1]]
    rp=mv(R,[1,0,0]); lp=mv(L,[1,0,0]); oe=orth_error(R); le=orth_error(L)
    assert oe<1e-12 and abs(norm(lp)-math.sqrt(1+angle**2))<1e-12
    s=SVG(1100,650,"Noncommuting rotations: fixed-axis Rx(90 deg) and Ry(90 deg)")
    paths=[]; rows=[]
    for panel,order in enumerate(["x_then_y","y_then_x"]):
        cx=280+540*panel; cy=310; scale=140
        def proj(p):return cx+scale*(.9*p[0]-.9*p[1]),cy+scale*(.4*p[0]+.4*p[1]-.85*p[2])
        for vec,label in [([1.2,0,0],"x"),([0,1.2,0],"y"),([0,0,1.2],"z")]:
            s.arrow(*proj([0,0,0]),*proj(vec),"#aeb8c6",1.5); px,py=proj(vec); s.text(px+6,py,label,16)
        s.text(cx,80,"Rx, then Ry" if panel==0 else "Ry, then Rx",20,anchor="middle",bold=True)
        f,g=(rx,ry) if panel==0 else (ry,rx)
        first=[mv(f(angle*i/90),point) for i in range(91)]
        middle=first[-1]; second=[mv(g(angle*i/90),middle) for i in range(91)]
        s.poly([proj(p) for p in first],BLUE,3); s.poly([proj(p) for p in second],RED,3)
        s.circle(*proj(point),5,GREEN); s.circle(*proj(middle),5,BLUE); s.circle(*proj(second[-1]),6,RED)
        s.arrow(*proj([0,0,0]),*proj(second[-1]),RED,2)
        s.text(cx,565,"final = (1, 0, -1)" if panel==0 else "final = (0, 1, 1)",19,RED,anchor="middle")
        for i,p in enumerate(first):rows.append([order,1,angle*i/90,*p])
        for i,p in enumerate(second):rows.append([order,2,angle*i/90,*p])
    s.text(550,610,"Start p = (1, 1, 0). Blue: first rotation; red: second rotation. Norm stays sqrt(2).",17,anchor="middle")
    s.write(a.asset_dir/"02-rotation-order.svg")
    save_csv(a.data_dir/"02-rotation-order-data.csv",["order","stage","angle_rad","x","y","z"],rows)
    s=SVG(1100,650,"Finite rotation and first-order tangent update")
    circle=[[math.cos(2*math.pi*i/360),math.sin(2*math.pi*i/360),0] for i in range(361)]
    for panel,M,name,color in [(0,R,"R = Exp(theta)",BLUE),(1,L,"L = I + [theta]x",RED)]:
        p=axes(s,(80+540*panel,130,390,390),(-2.2,2.2),(-2.2,2.2),[(-2,"-2"),(0,"0"),(2,"2")],[(-2,"-2"),(0,"0"),(2,"2")],"x","y")
        s.text(275+540*panel,80,name,21,color,anchor="middle",bold=True)
        s.poly([p(x[0],x[1]) for x in circle],GRAY,2,"5 5")
        transformed=[mv(M,x) for x in circle]; s.poly([p(x[0],x[1]) for x in transformed],color,3)
        end=mv(M,[1,0,0]); s.arrow(*p(0,0),*p(end[0],end[1]),color,3)
        s.text(275+540*panel,610,"Length = 1.000" if panel==0 else f"Length = {norm(lp):.3f}",18,color,anchor="middle")
    s.write(a.asset_dir/"02-rotation-update.svg")
    save_csv(a.data_dir/"02-rotation-update-data.csv",["input_x","input_y","exact_x","exact_y","linear_x","linear_y"],[[*p[:2],*mv(R,p)[:2],*mv(L,p)[:2]] for p in circle])
    save_json(a.data_dir/"02-numerical-results.json",{
      "source":"Sola et al. micro Lie theory v9, Example4 PDFp.5 (Rodrigues), Example6 and Sec.II.G PDFpp.7-8 (local update and rotation action)",
      "chosen_parameters":{"rotation_angles_deg":[90,90],"point":[1,1,0],"update_vector":[0,0,angle]},
      "rotation_order":{"Rx_then_Ry":xy,"Ry_then_Rx":yx,"norm":norm(point)},
      "update":{"exact_point":rp,"linear_point":lp,"exact_orthogonality_error":oe,"linear_orthogonality_error":le,"linear_point_norm":norm(lp),"linear_determinant":1+angle**2},"checks_passed":True})
    print("02: composition order, norm preservation and tangent-update checks passed.")
if __name__=="__main__":main()
