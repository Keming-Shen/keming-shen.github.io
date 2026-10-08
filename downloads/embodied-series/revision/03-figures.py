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

def fk(q):
    q1,q2=q; return [math.cos(q1)+math.cos(q1+q2),math.sin(q1)+math.sin(q1+q2)]
def ik(x,y,branch=1):
    c=(x*x+y*y-2)/2
    if not -1<=c<=1:raise ValueError("Target outside the unit-link workspace.")
    q2=branch*math.acos(c)
    q1=math.atan2(y,x)-math.atan2(math.sin(q2),1+math.cos(q2))
    return [q1,q2]
def jac(q):
    q1,q2=q; return [[-math.sin(q1)-math.sin(q1+q2),-math.sin(q1+q2)],[math.cos(q1)+math.cos(q1+q2),math.cos(q1+q2)]]
def solve2(A,b):
    d=A[0][0]*A[1][1]-A[0][1]*A[1][0]
    return [(A[1][1]*b[0]-A[0][1]*b[1])/d,(-A[1][0]*b[0]+A[0][0]*b[1])/d]
def main():
    a=args(); target=[1.,1.]; branches=[ik(*target,k) for k in [1,-1]]
    errors=[norm([x-y for x,y in zip(fk(q),target)]) for q in branches]; assert max(errors)<1e-12
    three_link=[]
    for q in branches:
        q3=-sum(q)
        endpoint=[fk(q)[0]+.25*math.cos(sum(q)+q3),fk(q)[1]+.25*math.sin(sum(q)+q3)]
        assert norm([x-y for x,y in zip(endpoint,[1.25,1])])<1e-12
        three_link.append({"q_rad":[*q,q3],"endpoint_m":endpoint,"orientation_rad":sum(q)+q3})
    v=[.2,0.]; near=[1.9999,0.]; nq=ik(*near); nv=solve2(jac(nq),v)
    assert norm([x-y for x,y in zip(mv(jac(nq),nv),v)])<1e-12
    rows=[]
    for i in range(201):
        d=10**(-4*i/200); x=2-d; q=ik(x,0); vel=solve2(jac(q),v)
        error=norm([a-b for a,b in zip(mv(jac(q),vel),v)])
        assert error<1e-10
        rows.append([d,x,*q,*vel,error])
    s=SVG(1100,630,"Two-link inverse kinematics and near-singular joint speed")
    p=axes(s,(75,115,350,350),(-.2,1.3),(-.2,1.3),[(0,"0"),(.5,"0.5"),(1,"1")],[(0,"0"),(.5,"0.5"),(1,"1")],"x (m)","y (m)")
    for q,color in zip(branches,[BLUE,RED]):
        elbow=[math.cos(q[0]),math.sin(q[0])]
        pts=[[0,0],elbow,target]; s.poly([p(*x) for x in pts],color,4); s.circle(*p(*elbow),6,color)
    s.circle(*p(0,0),5,GRAY); s.circle(*p(*target),6,GREEN)
    s.text(95,85,"l1 = l2 = 1 m; target = (1, 1) m",18)
    s.text(95,550,"(theta1, theta2) = (0, 90 deg)",17,BLUE); s.text(95,580,"or (90, -90 deg)",17,RED)
    q=axes(s,(635,115,390,350),(0,4),(-1.1,1.5),[(0,"1"),(1,"0.1"),(2,"0.01"),(3,"0.001"),(4,"0.0001")],[(-1,"0.1"),(0,"1"),(1,"10")],"Distance d = 2 - x (m), log scale","|Joint speed| (rad/s), log scale")
    s.poly([q(-math.log10(r[0]),math.log10(abs(r[4]))) for r in rows],BLUE,3)
    s.poly([q(-math.log10(r[0]),math.log10(abs(r[5]))) for r in rows],RED,3,"6 4")
    s.text(655,85,"vx = 0.2 m/s, vy = 0; y = 0",18)
    s.text(655,550,"Blue: |theta1_dot|; red: |theta2_dot|",17)
    s.text(655,580,f"At d = 0.0001 m: {nv[0]:.3f}, {nv[1]:.3f} rad/s",17)
    s.write(a.asset_dir/"03-ik-and-singularity.svg")
    save_csv(a.data_dir/"03-singularity-data.csv",["distance_to_extension_m","x_m","theta1_rad","theta2_rad","theta1_rate_rad_s","theta2_rate_rad_s","velocity_residual"],rows)
    save_json(a.data_dir/"03-numerical-results.json",{
      "source":"Asada MIT2.12 Ch4 Example4.2 PDFpp.4-6, wrist IK branches; Ch5 Sec5.1-5.3 PDFpp.1-7, unit-link Jacobian and near-singular constant-speed example",
      "parameters":{"link_lengths_m":[1,1],"ik_target_m":target,"near_extension_target_m":near,"requested_velocity_m_s":v},
      "inverse_kinematics":{"branches_rad":branches,"branches_deg":[[math.degrees(x) for x in q] for q in branches],"position_residuals":errors,"three_link_extension":{"l3_m":.25,"target_pose":[1.25,1,0],"branches":three_link}},
      "near_singularity":{"configuration_rad":nq,"joint_rates_rad_s":nv,"velocity_reconstruction":mv(jac(nq),nv)},"checks_passed":True})
    print("03: both IK branches and 201 Jacobian velocity reconstructions passed.")
if __name__=="__main__":main()
