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

def main():
    a=args()
    t=[1.,2.,3.]; b=[1.,2.,2.]
    C,D=2/3,1/2; pred=[C+D*x for x in t]; residual=[v-p for v,p in zip(b,pred)]
    dot1=sum(residual); dott=sum(x*e for x,e in zip(t,residual)); sse=sum(e*e for e in residual)
    assert abs(dot1)<1e-12 and abs(dott)<1e-12 and abs(sse-1/6)<1e-12
    save_csv(a.data_dir/"01-least-squares-data.csv",["t","observation","fit","residual"],zip(t,b,pred,residual))
    s=SVG(850,530,"Least squares: three observations and one fitted line")
    p=axes(s,(90,95,650,325),(0,4),(0,2.7),[(i,str(i)) for i in range(5)],[(i,str(i)) for i in range(3)],"t","b")
    s.poly([p(0,C),p(4,C+4*D)],BLUE,3)
    for x,y,z in zip(t,b,pred):
        s.line(*p(x,y),*p(x,z),RED,3,"5 4"); s.circle(*p(x,y),5,RED); s.circle(*p(x,z),3,BLUE)
    s.text(115,485,"Fit: C = 2/3, D = 1/2",17,BLUE); s.text(485,485,"Squared residual sum = 1/6",17,RED)
    s.write(a.asset_dir/"01-least-squares.svg")
    A=[[4.,4.],[-3.,3.]]; inv=1/math.sqrt(2); v1=[inv,inv]; v2=[inv,-inv]
    sig=[4*math.sqrt(2),3*math.sqrt(2)]; u1=[1.,0.]; u2=[0.,-1.]
    err=max(norm([x-y for x,y in zip(mv(A,v),[sigma*c for c in u])]) for v,sigma,u in [(v1,sig[0],u1),(v2,sig[1],u2)])
    assert err<1e-12
    theta=[2*math.pi*i/360 for i in range(361)]; circle=[[math.cos(x),math.sin(x)] for x in theta]; ellipse=[mv(A,x) for x in circle]
    save_csv(a.data_dir/"01-svd-data.csv",["angle_rad","input_x","input_y","output_x","output_y"],[[q,*x,*y] for q,x,y in zip(theta,circle,ellipse)])
    s=SVG(1080,570,"SVD: A maps orthogonal input directions to orthogonal output directions")
    p=axes(s,(75,110,350,350),(-1.3,1.3),(-1.3,1.3),[(-1,"-1"),(0,"0"),(1,"1")],[(-1,"-1"),(0,"0"),(1,"1")],"Input coordinates","Unit circle")
    q=axes(s,(635,110,350,350),(-6,6),(-6,6),[(-6,"-6"),(0,"0"),(6,"6")],[(-6,"-6"),(0,"0"),(6,"6")],"Output coordinates","A times the unit circle")
    s.poly([p(*x) for x in circle],GRAY,2); s.poly([q(*x) for x in ellipse],GRAY,2)
    s.arrow(*p(0,0),*p(*v1),BLUE,3); s.arrow(*p(0,0),*p(*v2),RED,3)
    s.text(*p(.3,.93),"v1",16,BLUE); s.text(*p(.3,-.86),"v2",16,RED)
    s.arrow(*q(0,0),*q(*mv(A,v1)),BLUE,3); s.arrow(*q(0,0),*q(*mv(A,v2)),RED,3)
    s.text(*q(1,1),"sigma1 = 5.657",16,BLUE); s.text(*q(.5,-3),"sigma2 = 4.243",16,RED)
    s.arrow(470,275,585,275,GRAY,2); s.text(527,248,"A",19,anchor="middle",bold=True)
    s.text(540,545,"A = [[4, 4], [-3, 3]]; input and output axes use different scales.",16,anchor="middle")
    s.write(a.asset_dir/"01-svd.svg")
    save_json(a.data_dir/"01-numerical-results.json",{
      "source":{"least_squares":"MIT 18.06SC Lecture 16 summary, PDF pp.1-2, points (1,1),(2,2),(3,2)","svd":"MIT 18.06SC Lecture 29 summary, PDF pp.2-3, A=[[4,4],[-3,3]]"},
      "least_squares":{"C":C,"D":D,"residual":residual,"squared_error":sse,"orthogonality_checks":[dot1,dott]},
      "svd":{"A":A,"singular_values":sig,"max_direction_mapping_error":err},"checks_passed":True})
    print("01: least-squares residual and SVD direction checks passed.")
if __name__=="__main__":main()

